# Spec

All figures are **estimates** in grams of CO2-equivalent (g CO2e) with a low and high value.
"Not estimated" usage is always shown, never silently dropped or counted as zero.

## Management API surface

OpenAPI document `ai-carbon-management`, base route `/umbraco/ai-carbon/management/api/v1`.
Every endpoint requires a signed-in backoffice user who passes Umbraco.AI's
`SectionAccessAI` policy; otherwise `401` (not signed in) or `403` (no AI section access).

### `GET /estimate`

Query: `from` (ISO 8601, required), `to` (ISO 8601, required), `granularity`
(`Hourly` | `Daily`, optional; when omitted the same automatic choice Umbraco.AI makes).

Validation: `from` must be before `to`, else `400` problem details naming the field. The window may be at most 93 days for `Hourly` and 1,830 days for `Daily` (after the automatic choice), else `400` naming the field; this keeps the zero-filled series bounded. Inputs without an offset are treated as UTC. A range
older than Umbraco.AI's retention returns whatever data exists (possibly empty), not an error.

Response `200`:

```jsonc
{
  "from": "...", "to": "...", "granularity": "Hourly",
  "total":     { "co2eGrams": { "min": 0.0, "max": 0.0 }, "energyWh": { "min": 0.0, "max": 0.0 },
                 "requests": 0, "outputTokens": 0 },
  "byModel":   [ { "providerId": "openai", "modelId": "gpt-4o-2024-08-06",
                   "matchedAs": "openai/gpt-4o",          // null when not estimated
                   "electricityZone": "USA",               // zone used for this row; null when not estimated
                   "status": "Estimated",                  // Estimated | UnknownModel | UnsupportedCapability
                   "co2eGrams": { "min": 0, "max": 0 },    // null when not estimated
                   "requests": 0, "outputTokens": 0,
                   "warnings": [ "model-arch-not-released" ] } ],
  "byFeature": { "available": true,
                 "items": [ { "featureType": "agent", "co2eGrams": { "min": 0, "max": 0 }, "requests": 0 } ] },
  "timeSeries":[ { "timestamp": "...", "co2eGrams": { "min": 0, "max": 0 } } ],
  "notEstimated": { "requests": 0, "outputTokens": 0, "models": 0 },
  "method": { "source": "EcoLogits", "dataVersion": "vX.Y.Z",
              "electricityZone": "USA",                // override, else the one zone all rows share, else null (mixed)
              "electricityZones": [ "USA" ],           // distinct zones actually used, sorted
              "zoneIsOverride": false,
              "analyticsEnabled": true }
}
```

Guarantees:
- `total.co2eGrams` equals the sum of estimated `byModel` rows (min with min, max with max).
- `byFeature.items` sum to `total` (the last item is `"other"` when non-zero). When Umbraco.AI's
  feature-type dimension is off, `available` is `false` and `items` is empty.
- `timeSeries` buckets sum to `total`, one point per bucket in range (zeros included).
- `min ≤ max` everywhere. Unresolved models appear in `byModel` with `status` set and
  `co2eGrams: null`, and are summed in `notEstimated`.
- When Umbraco.AI analytics are disabled, returns `200` with zeros and
  `method.analyticsEnabled: false`.
- The same request within 5 minutes may return a cached result.

## Frontend components

All in `Umbraco.Community.AI.Carbon.Web.StaticAssets/Client`, Lit + UUI, strings localized.

**`aicarbon-workspace-view` (the "CO2" tab)** — `workspaceView` on
`UmbracoAI.Workspace.AnalyticsRoot`, shown after "Dashboard".
- Header row: title, a date-range selector (`Last 24 Hours` / `Last 7 Days` / `Last 30 Days`,
  same options as the Usage dashboard; a short static list, so a `uui-select` is a deliberate
  choice, not a missing picker), and a "How is this calculated?" button.
- Four summary cards: estimated CO2e (shown as a range, e.g. "1.2–8.4 g CO2e"), estimated energy
  (Wh range), requests estimated, and models not estimated (count, warning colour when > 0).
- Trend chart: a shaded band between min and max over time, using the bucket timestamps.
- "By model" table: model id, matched as, electricity zone, requests, output tokens, CO2e range, status badge;
  rows with warnings show an info icon with the plain-English warning on hover.
- "By feature" table: agents, prompts, inline types, other. When unavailable, a short note
  instead: "Feature breakdown is switched off in Umbraco.AI analytics settings."
- Units scale for readability (mg / g / kg), always with "CO2e" and never a bare number.

**`aicarbon-method-panel`** — opened from the header button as a sidebar modal. Explains in
plain words: what is counted (text-generation output tokens), what isn't (input tokens,
embeddings, images, training), the electricity zone in use and whether it is an override, the
EcoLogits data version with a link and MPL credit, that ranges are wide because closed-model
sizes aren't published, and the "unofficial, not Umbraco HQ" notice.

### UX spots

1. **First run.** No usage in range: an empty state saying "No AI usage in this period yet",
   with a hint to widen the date range. Analytics disabled: a different message explaining that
   Umbraco.AI analytics are switched off, so there is nothing to estimate.
2. **The mistake.** API failure: a `uui-box` error saying the estimate couldn't be loaded and to
   try again, with a Retry button. A `403` shows "You need access to the AI section to see this".
   Misconfigured `ElectricityZone`: the panel shows which zone was actually used.
3. **The wait.** `uui-loader-bar` while loading; changing the date range keeps the old figures
   visible but dimmed until the new ones arrive, so the page doesn't jump.
4. **The finish.** Deliberate skip: read-only screen, no save action. Loaded figures replacing the
   loader is the confirmation.
5. **The return.** The selected date range is remembered per user in `localStorage` (wrapped in
   try/catch; falls back to "Last 7 days").
