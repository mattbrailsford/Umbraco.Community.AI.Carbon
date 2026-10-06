[Plan folder](https://github.com/mattbrailsford/Umbraco.Community.AI.Carbon/tree/v18/feature/estimated-co2-dashboard/docs/plans/estimated-co2-dashboard)

## Why the change

Umbraco.AI's Analytics shows requests and tokens but nothing about environmental cost, so this adds a "CO2" tab that turns recorded usage into a rough, honestly ranged CO2e estimate using EcoLogits, without any change to Umbraco.AI.

## Special things to note

- **Needs a decision:** the method panel copy (`Client/src/lang/en.ts`) and `README.md` are public-facing text about CO2. Reviewers fact-checked every sentence against the code and EcoLogits 0.11.2, but no human has read them yet. Read them before release, and decide whether marketing or legal should look at the environmental wording.
- **Needs a decision:** window limits are 93 days for hourly and 1,830 days for daily (`AICarbonEstimateLimits`). The service throws and the API returns 400 above them. The limits keep the zero-filled time series bounded. The numbers were chosen during the build, not by you.
- **Needs a decision:** the public result and extension types (`AICarbonEstimate`, `AICarbonModelEstimate`, `RangeValue`, `EcoLogitsModel`, `IAICarbonModelResolver` and others) are positional records, and package validation is off. Before 1.0, decide whether to freeze these shapes or move to init-only properties.
- **Needs a decision:** this inherits an Umbraco.AI behaviour. With daily buckets, today's already-aggregated hours are missing until Umbraco.AI's daily rollup runs, the same as on its Usage dashboard. Decide whether to raise this on umbraco/Umbraco.AI.
- Request counts are successful calls only. Output tokens include failed calls' tokens, because those tokens still used energy.
- The integration endpoint tests use two test-only workarounds: they set Umbraco's static `TestConfiguration` by reflection, and copy `deps.json` as `Umbraco.Tests.Integration.deps.json`. The TestServer base has no hook for either. Both fail loudly if Umbraco changes.
- Two spec expectations changed during the build. A dated model id now matches the dated EcoLogits model (EcoLogits' own alias semantics), not the short name.
- The end-to-end check used 505 seeded hourly usage rows in the demo database, not real provider calls (your call). Covered in the browser: cards, chart, by-model rows (including the Bedrock id match and not-estimated rows), by-feature, method panel, range memory and the analytics-off state.
- EcoLogits 0.11.2 data and two ported files (`EcoLogitsProviderConfigs.cs`, `CarbonFactorCalculator.cs`) are MPL-2.0. They carry headers, and `THIRD-PARTY-NOTICES.md` is packed into the Core nupkg. The rest is MIT.
- README links to `THIRD-PARTY-NOTICES.md` and `LICENSE` point at `blob/v18/main`. They 404 until the first release. The pre-release banner also needs updating at release.
- After a side-by-side check, the layout now mirrors Umbraco.AI's Usage dashboard: header on the page, compact cards, the chart and each table in their own box. By your choice it differs in four ways: edge-to-edge tables, an icon-only "How is this calculated?" button, blue card icons instead of Usage's pale pink, and short status tags. The method explanation now sits behind the info icon (accessible label and tooltip), so check that is visible enough for the "say how CO2 is calculated" rule.
- Follow-up from your feedback (T22–T24): cards and cells lead with a rounded "≈" central figure, with the range in the same unit underneath. The Status column is gone, and not-estimated rows say so in the CO2e cell. An opt-in `AICarbon:ShowEquivalents` adds a thin strip like "Up to about 6.1 phone charges". It is based on the top of the estimate and rounded up, using US EPA (Oct 2024, CO2 only) and UK DESNZ 2025 factors read from the primary sources.
- **Needs a decision:** the comparison and its panel text are new public-facing environmental wording. They need a human read with the rest of the copy.
- The v17 line (T21) is a separate follow-up after this merges.
- No database tables, migrations or Deploy concerns. Everything is computed on read.

## Change outline

New projects and folders. Core holds the estimation, Web the API, StaticAssets the tab.

```diff
 src/
 ├── Umbraco.Community.AI.Carbon/                    # meta-package (unchanged)
 ├── Umbraco.Community.AI.Carbon.Core/
+│   ├── Data/EcoLogits/                             # embedded models.json + electricity_mixes.json (0.11.2, MPL-2.0)
+│   ├── EcoLogits/                                  # data repository + provider config port
+│   ├── Configuration/                              # AICarbonOptions, never-throw startup validation, marker guard
+│   ├── Resolution/                                 # IAICarbonModelResolver chain (mapping → provider → normalised name)
+│   └── Estimation/                                 # calculator port, estimate service, feature split, cache decorator, limits
 ├── Umbraco.Community.AI.Carbon.Web/
+│   └── Api/Management/Estimate/                    # GET /estimate, validation, response models, mapper
 └── Umbraco.Community.AI.Carbon.Web.StaticAssets/Client/src/
+    ├── api/                                        # generated hey-api client
+    ├── estimate/                                   # repository, alignedWindow, formatting, warnings
+    ├── workspace-view/ header/ summary/ trend/     # CO2 tab, range select, cards, Chart.js band
+    ├── by-model/ by-feature/ method/               # tables + "How is this calculated?" sidebar
+    └── lang/en.ts
```

The Management API contract, `GET /umbraco/ai-carbon/management/api/v1/estimate?from&to&granularity`, gated by Umbraco.AI's `SectionAccessAI` policy:

```jsonc
{
  "from": "…Z", "to": "…Z", "granularity": "Hourly",
  "total":       { "co2eGrams": { "min", "max" }, "energyWh": { "min", "max" }, "requests", "outputTokens" },
  "byModel":     [ { "providerId", "modelId", "matchedAs", "electricityZone", "status", "co2eGrams", "requests", "outputTokens", "warnings" } ],
  "byFeature":   { "available", "items": [ { "featureType", "co2eGrams", "requests" } ] },
  "timeSeries":  [ { "timestamp", "co2eGrams" } ],
  "notEstimated":{ "requests", "outputTokens", "models" },
  "method":      { "source", "dataVersion", "electricityZone", "electricityZones", "zoneIsOverride", "analyticsEnabled" }
}
```

How one estimate is built. It only uses Umbraco.AI's public analytics service, called one at a time:

```
GetEstimateController.GetEstimate (validate window → 400)
  CachedAICarbonEstimateService            # 5 min runtime cache, key = UTC window + granularity + zone + analytics flags
    AICarbonEstimateService
      IAIUsageAnalyticsService.GetBreakdownByProvider / ByModel   # model breakdown has no provider → pair them
      per (provider, model):
        GetSummaryAsync (all capabilities)                        # detect usage, non-chat remainder
        GetTimeSeriesAsync (Capability = Chat)                    # per-bucket successes + output tokens
        AICarbonModelResolverCollection.Resolve                   # → EcoLogitsModel or "not estimated"
        ModelFactorResolver → CarbonFactorCalculator              # EcoLogits llm.py port, zone override or provider default
        factor.Apply(outputTokens, successes) per bucket          # totals summed from buckets
      AICarbonFeatureSplitter (agent / prompt / inline-chat / inline-agent / other)
```

The backoffice tab, a workspaceView on `UmbracoAI.Workspace.AnalyticsRoot` after "Dashboard":

```
<aicarbon-workspace-view>          view-state switch: loading / content (dimmed reload) / empty / analyticsDisabled / error+Retry / forbidden
  <aicarbon-header>                range select (remembered in localStorage) + "How is this calculated?" → sidebar modal
  <aicarbon-summary-cards>         CO2e range, energy range, requests, models not estimated
  <aicarbon-trend-chart>           Chart.js min/max band, UTC buckets, one y unit
  <aicarbon-model-table>           matched model, zone, requests, tokens, CO2e, status + warning tooltips
  <aicarbon-feature-table>         agents / prompts / inline / other
```

Tests: 373 unit, 49 integration (real Umbraco host with Umbraco.AI), 222 Vitest. Calculator results match EcoLogits to 4.4e-16 across all 348 models.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_014KRhwDban1s3aQSXzYcwbt
