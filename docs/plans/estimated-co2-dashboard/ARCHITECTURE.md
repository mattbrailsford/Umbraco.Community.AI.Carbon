# Architecture

## Extension points

**Backoffice: a `workspaceView` on Umbraco.AI's Analytics workspace.** The Analytics screen is
a standard workspace (`UmbracoAI.Workspace.AnalyticsRoot`, same alias on v17 and v18) whose only
view today is "Dashboard" (weight 1000). The package registers a second `workspaceView`
("CO2", `icon-leaf` or similar, weight below 1000 so it sits after Dashboard) conditioned on
`Umb.Condition.WorkspaceAlias` matching that alias.

- Why: it puts the figures exactly where the brief says, needs no Umbraco.AI change, and
  inherits Analytics' section, menu and permissions for free.
- Rejected: a dashboard in another section (wrong place, users won't find it); a custom
  section (far too heavy for one screen); a property on the Usage dashboard itself (would need
  Umbraco.AI changes).
- The alias is a plain string, not an exported constant, so the package declares its own copy.
  If Umbraco.AI renames it the tab disappears silently; this is accepted and covered by a manual
  smoke check per Umbraco.AI release.

**Backend: an `IComposer` (already scaffolded, `AICarbonComposer`) plus one Management API
controller** with its own OpenAPI document (`ai-carbon-management`), mirroring Content Checks'
Web project.

## Data model & persistence

**None.** Everything is computed on request from:

1. Umbraco.AI's recorded usage, read only through the public `IAIUsageAnalyticsService`
   (`GetBreakdownByModelAsync` to list models, then `GetSummaryAsync` /
   `GetTimeSeriesAsync` with an `AIUsageFilter` for per-model and per-feature output tokens).
2. Static EcoLogits reference data shipped inside the Core assembly as embedded resources:
   `models.json` (model sizes + aliases) and `electricity_mixes.json` (grams CO2e per kWh by
   country, ISO 3166-1 alpha-3, plus `WOR` world average).

No database, no migrations, so SQL Server vs SQLite does not apply.

### Estimation model (port of EcoLogits `impacts/llm.py`)

Computed per (model, bucket) from **output tokens `O`** and **request count `R`** only. Input
and cached tokens do not enter EcoLogits' model, which confirms the brief's assumption 5.

| Step | Formula (EcoLogits constants) |
|------|-------------------------------|
| GPU energy per token (kWh) | `(α·e^(β·64)·P_active + γ) / 1000`, α=1.1665e-6, β=-0.011206, γ=4.0529e-5 |
| Latency per token (s) | `1/tps` if known, else `0.0006785·P_active + 0.0003119·64 + 0.019474` |
| Generation latency (s) | `O·latencyPerToken + R·ttft` (ttft 0 when unknown) |
| GPUs needed | `2^ceil(log2(ceil(1.2·P_total·16/8 / 80)))` |
| Server energy (kWh) | `latency/3600 · 1.2 kW · gpus/8 · 1/64` |
| Request energy (kWh) | `PUE · (serverEnergy + gpus · O · gpuEnergyPerToken)` |
| Usage CO2e (kg) | `requestEnergy · mix.gwp` |
| Embodied CO2e (kg) | `latency · ((gpus/8)·5700 + gpus·273) / (3 years in s · 64)` |
| **Total CO2e** | usage + embodied |

`P_active`/`P_total` are billions of parameters; closed models carry a min-max range, so every
output is a `(min, max)` pair computed end to end, never a single number.

**Deliberate simplification:** EcoLogits caps generation latency at the measured request
latency. Umbraco.AI's time series has no duration field, so the cap is dropped everywhere for
consistency. Measured latency normally includes network and prompt time, so the cap rarely
binds; the "how this is calculated" panel says so.

> ASSUMPTION: Because the result is linear in `O` and `R` per model, the service computes one
> `CarbonFactor` (kg CO2e per output token + per request, min/max) per resolved model and
> multiplies it by usage, rather than re-running the full formula per bucket.

## Connected systems

This is a read-only reporting feature with no entities, so most of the usual fan-out does not
apply:

| System | Applies? | Why |
|--------|----------|-----|
| Permissions | **Yes** | API uses Umbraco.AI's own `AIAuthorizationPolicies.SectionAccessAI` policy (public, in `Umbraco.AI.Web`), so whoever can see Analytics can see CO2 and nobody else. The UI view inherits the workspace's section condition. |
| Localization | **Yes** | All UI strings go through `umbLocalize`/`localize.term` with an `en` dictionary, matching Umbraco.AI. |
| Configuration | **Yes** | `AICarbon` appsettings section (see Key decisions). Validated on startup; invalid zone falls back to provider default with a log warning. |
| Licensing notice | **Yes** | Ported EcoLogits files and data keep MPL-2.0 headers; `THIRD-PARTY-NOTICES.md` at repo root; the panel credits EcoLogits with a link. |
| Version history / audit | No | Nothing is created or edited. |
| Deploy connectors | No | No entities; config travels in appsettings. |
| Notifications / events | No | Nothing changes state. |
| Cache refreshers / load balancing | No | Stateless; any short-lived result cache is per-server and safe to differ briefly. |
| Search indexing | No | Nothing to index. |
| Telemetry | No | Out of scope for a showcase. |

## Key decisions

1. **Compute on read, no persistence.** Umbraco.AI already keeps the usage history (30 days
   hourly, 365 daily). Storing CO2 would duplicate it and go stale when the reference data
   updates. Rejected: a background job writing CO2 rows (migrations on two DB engines, two CMS
   lines, for no gain).

2. **Read usage only via the public `IAIUsageAnalyticsService`.** Rejected: hooking Umbraco.AI's
   middleware or notifications to record our own per-call data (more moving parts, misses
   history recorded before install) and reading Umbraco.AI's tables directly (internal, breaks
   on schema changes). Cost: breakdowns return only total tokens and the by-model breakdown
   groups on model id alone (no provider), so the service lists providers and models from the two
   breakdowns, then makes one filtered `GetSummaryAsync` per (provider, model) pair with
   `Capability = Chat` (pairs with zero requests are discarded), plus one per pair without the
   capability filter to count non-chat usage, plus one per pair × feature type. Acceptable at
   realistic counts (a few providers, under ~20 models) and cached for 5 minutes.

3. **Model resolution is a chain of `IAICarbonModelResolver`s in a collection builder**, first
   match wins, so new matching rules are a new class, not an edit:
   1. `ConfiguredMappingResolver` — explicit `AICarbon:ModelMappings` from appsettings
      (`"my-azure-deployment": "openai/gpt-4o"`). Lets admins fix Foundry deployment names.
   2. `DirectProviderResolver` — looks up the Umbraco.AI provider id in
      `AICarbon:ProviderMappings` and, if mapped, finds the model by exact name or EcoLogits alias
      under that EcoLogits provider. The mapping is **settings, not code**: the package ships
      defaults (`openai→openai`, `anthropic→anthropic`, `google→google_genai`,
      `mistral→mistralai`, `huggingface→huggingface_hub`) and appsettings entries add to or
      replace them, so a new Umbraco.AI provider (or a new EcoLogits vendor) needs no release.
   3. `NormalizedNameResolver` — applies to **any** provider, with no list of provider names:
      strips known vendor prefixes and suffixes (`us.anthropic.`, `anthropic/`, `-v1:0`, date
      stamps), then searches all EcoLogits providers by name or alias. When the same name exists
      under more than one EcoLogits provider: prefer the vendor named in a stripped prefix, then a
      first-party vendor over `huggingface_hub`; if still ambiguous, resolve to nothing and log
      the candidates.
   So a brand-new Umbraco.AI provider with no mapping still gets estimates whenever EcoLogits
   knows its model names. The decoration-stripping rules stay in code (a short list of patterns);
   a host with a new naming style needs a new rule or a custom resolver.
   Unresolved models are returned as "not estimated" with their token counts, never dropped.
   Rejected: one big matching method (every new provider edits the same function), and a
   hard-coded provider map (every new provider would need a package release).

4. **Electricity mix: EcoLogits' per-provider default, with one global override.** EcoLogits
   assigns each provider a data-centre zone (mostly `USA`) plus PUE/WUE. The package uses that by
   default and lets `AICarbon:ElectricityZone` (e.g. `SWE`, `DNK`, `WOR`) override it site-wide.
   Data-centre settings are keyed by EcoLogits provider, so the *resolved model's* EcoLogits
   provider config is used, whichever Umbraco.AI provider served the call.
   This refines the brief's guess of "default to world average": provider defaults are closer to
   reality and match EcoLogits' own output, so figures can be cross-checked against its
   calculator.

5. **Own UI components, not Umbraco.AI's analytics elements.** Umbraco.AI's
   `uai-analytics-*` elements are registered globally but live in its internal barrel, not
   `exports.ts`, so they are not a public contract, and its Chart.js copy is bundled privately.
   The package builds its own small elements from UUI (`uui-box`, `uui-table`) styled to match the
   Usage dashboard's layout, and bundles its own Chart.js.
   > ASSUMPTION: matching look matters more than zero duplication for a showcase. A later
   > upstream change exporting those elements from `@umbraco-ai/core` would let the package switch
   > to them; that's a nice-to-have, not a dependency.
   Rejected: using the internal tags by name (silent breakage on an Umbraco.AI refactor, and no
   types).

6. **Feature split via known feature types plus "Other".** There is no breakdown-by-feature
   method, and feature types are open strings. The service queries the known values (`agent`,
   `prompt`, and the inline chat/embedding/image types from `Umbraco.AI.Core.Constants.FeatureTypes`)
   with `AIUsageFilter.FeatureType`, and reports `Other = total − sum(known)`. If the feature-type
   dimension is switched off in Umbraco.AI's options, the split is reported as unavailable.

7. **Text generation only (capability `Chat`).** Embedding, image and speech usage is counted and
   shown as "not estimated" (method not supported), per the brief's non-goals.

8. **Result caching.**
   > ASSUMPTION: estimates are cached in Umbraco's runtime cache for 5 minutes per (from, to,
   > granularity) key. Usage is aggregated hourly anyway, so a fresher figure adds nothing.

9. **Reference data refresh is manual.** A `scripts/update-ecologits-data.{sh,ps1}` pulls the two
   JSON files from a pinned EcoLogits tag; the package reports that tag in the API response so the
   UI can say which data version it used. Rejected: downloading at runtime (network dependency,
   unpredictable figures).

10. **Package dependencies.** Core takes `Umbraco.AI.Core`; Web additionally takes `Umbraco.AI.Web`
    (for the authorization policy constant). Both as NuGet ranges per CMS major.
