# Plan

Ordered for `umb-build-loop`. Top to bottom is a valid build order. Tasks in the same
`parallel-group` touch different files and have no ordering between them; tasks with no group
run alone. Every entry-point task (`wire:`) is accepted through the running demo site, not unit
tests alone.

**Pending specs.** Spec files are written ahead of the code as `*.pending.cs` /
`*.pending.test.ts`, which the test projects and `tsconfig` exclude, so the solution still
builds. When a task starts, the builder renames that task's spec files (drop `.pending`), makes
them compile and pass, and only then marks the task done. Each spec file names its task in its
header comment. EcoLogits reference values in the specs come from EcoLogits 0.11.2, the version
T1 pins.

Paths are relative to the repo root. `Core` = `src/Umbraco.Community.AI.Carbon.Core`,
`Web` = `src/Umbraco.Community.AI.Carbon.Web`, `Client` =
`src/Umbraco.Community.AI.Carbon.Web.StaticAssets/Client`.

## Backend: reference data and maths

- [x] **T1** — EcoLogits reference data repository. Embed pinned `models.json` and
  `electricity_mixes.json` under `Core/Data/EcoLogits/` as embedded resources; internal
  `EcoLogitsDataRepository` loads models (dense/MoE, min/max params, tps/ttft, warnings),
  aliases, electricity mixes, and a C# port of EcoLogits' `PROVIDER_CONFIG_MAP` (zone, PUE,
  WUE ranges). Exposes the data version (EcoLogits tag). Behind an `IEcoLogitsDataRepository`
  interface, with `LoadEmbedded()` and an in-memory `FromModels(...)` for tests. Name lookups also
  match the last path segment, since Hugging Face names carry an org prefix (`openai/gpt-oss-120b`). Add `scripts/update-ecologits-data.{sh,ps1}`
  (pinned tag) and `THIRD-PARTY-NOTICES.md`; ported files carry MPL-2.0 headers.
  story: S1, S3 · depends-on: — · parallel-group: A

- [x] **T2** — Options. `AICarbonOptions` bound from `AICarbon` (`ElectricityZone`,
  `ModelMappings`, `ProviderMappings` with the five shipped defaults merged under appsettings
  entries), registered with startup validation that logs (not throws) on bad values, including a
  provider mapping that names an EcoLogits provider not in the data.
  story: S3, S6 · depends-on: — · parallel-group: A

- [x] **T3** — Carbon factor calculator. Internal port of EcoLogits `impacts/llm.py` producing a
  `CarbonFactor` (kg CO2e and kWh per output token and per request, min/max) for a model +
  provider config + electricity mix, with the latency cap dropped. Unit tests check against
  EcoLogits reference outputs within 1% and that min ≤ max.
  story: S1 (AC5, AC6, AC8) · depends-on: T1 · parallel-group: B

- [x] **T4** — Model resolver chain. Public `IAICarbonModelResolver`, collection builder
  (`builder.AICarbonModelResolvers()`), and three resolvers in order: `ConfiguredMappingResolver`,
  `DirectProviderResolver` (provider id → EcoLogits provider from `ProviderMappings`, then exact
  name/alias), `NormalizedNameResolver` (any provider; vendor prefix/suffix and date-stamp
  stripping, search across all EcoLogits providers, ambiguity rules from ARCHITECTURE.md). No
  Umbraco.AI provider names hard-coded outside the default `ProviderMappings`. Bad mapping
  targets log a warning and resolve to nothing.
  story: S3 · depends-on: T1, T2 · parallel-group: B

## Backend: estimate service

- [x] **T5** — Estimate service: totals and by model. Public `IAICarbonEstimateService.GetEstimateAsync(from, to, granularity)`
  using `IAIUsageAnalyticsService`: list providers and models from `GetBreakdownByProviderAsync`
  and `GetBreakdownByModelAsync` (the model breakdown carries no provider), then filtered
  `GetSummaryAsync` per (provider, model) pair with `Capability = Chat` for output
  tokens/requests (zero-request pairs discarded), resolve, apply factor. Non-chat
  capabilities → `UnsupportedCapability`; unresolved → `UnknownModel`; both summed in
  `NotEstimated`. Reports `analyticsEnabled` from `AIAnalyticsOptions`.
  story: S1, S2 · depends-on: T3, T4

- [x] **T6** — wire: estimate services into `AICarbonComposer`. Register data repository,
  calculator, resolvers, options and estimate service in `AddAICarbon()`. Acceptance: demo site
  starts cleanly and `IAICarbonEstimateService` resolves from the container (an integration test
  resolves it from a booted Umbraco instance; re-checked through T11's endpoint).
  story: S1 · depends-on: T5

- [x] **T7** — Time series. Per-model filtered `GetTimeSeriesAsync`, factor applied per bucket,
  zero-filled buckets, granularity passed through (or Umbraco.AI's auto choice). Buckets sum to
  total.
  story: S4 · depends-on: T5

- [x] **T8** — Feature split. Query known feature types (`agent`, `prompt`, and inline types
  from `Umbraco.AI.Core.Constants.FeatureTypes`) with `AIUsageFilter.FeatureType` per model,
  `other = total − known`; `available: false` when the feature-type dimension is off.
  story: S5 · depends-on: T7

- [x] **T9** — Electricity zone resolution. Provider default from the ported config map; hosting
  providers use the resolved model's provider config; `ElectricityZone` override; unknown zone
  logs and falls back. Response reports the zone actually used and `zoneIsOverride`.
  story: S6 · depends-on: T8

- [x] **T10** — Result cache. 5-minute runtime-cache entry per (from, to, granularity).
  story: S1 · depends-on: T9

## Backend: Management API

- [x] **T11** — wire: `GET /estimate` into the Management API. Web project gains a
  `Umbraco.AI.Web` package reference (range in `Directory.Packages.props`), its own OpenAPI
  document `ai-carbon-management`, controller at `/umbraco/ai-carbon/management/api/v1/estimate`
  with `[Authorize(Policy = AIAuthorizationPolicies.SectionAccessAI)]`, request validation
  (400 problem details when `from` ≥ `to`) and response DTOs matching `SPEC.md`. Acceptance on
  the demo site: 200 with real figures for an AI user, 401 signed out, 403 for a user without AI
  access, document listed in Swagger. Integration tests cover 200/400/401/403.
  story: S1 (AC9), S9 (AC1–AC3) · depends-on: T6, T10

## Frontend

- [x] **T12** — Generated client and repository. Run `npm run generate-client` against the demo
  site; `Client/src/estimate/` repository wrapping the generated service; configure the client
  auth in `app.ts` `onInit` (mirroring Content Checks).
  story: S1 · depends-on: T11

- [x] **T13** — wire: CO2 tab into the Analytics workspace. `workspaceView` manifest conditioned
  on `UmbracoAI.Workspace.AnalyticsRoot`, weight below 1000, `aicarbon-workspace-view` element
  shell, `en` localization dictionary. Acceptance: in the demo backoffice the "CO2" tab appears
  after "Dashboard" and loads data from `/estimate` (network request visible).
  story: S1 (AC1) · depends-on: T12

- [x] **T14** — Header and summary cards. Date-range `uui-select` (24h / 7d / 30d), CO2e,
  energy, requests and not-estimated cards, unit scaling (mg/g/kg, Wh/kWh) with "CO2e" label.
  story: S1 (AC2–AC4, AC7), S2 (AC6) · depends-on: T13 · parallel-group: C

- [x] **T15** — By-model table. `aicarbon-model-table` with matched-as, status badges and
  warning tooltips (plain-English text per EcoLogits warning code).
  story: S2 · depends-on: T13 · parallel-group: C

- [x] **T16** — Trend chart. `aicarbon-trend-chart` with bundled Chart.js, min-max band per bucket.
  story: S4 · depends-on: T13 · parallel-group: C

- [x] **T17** — By-feature table. `aicarbon-feature-table`, including the "switched off" note.
  story: S5 · depends-on: T13 · parallel-group: C

- [x] **T18** — Method panel. `aicarbon-method-panel` sidebar modal opened from the header;
  shows zone, override flag, data version, what is and isn't counted, EcoLogits credit and the
  unofficial notice.
  story: S7 · depends-on: T13 · parallel-group: C

- [x] **T19** — Compose the view and its states. Slot T14–T18 into the workspace view; loader
  bar, dimmed reload, empty state, analytics-disabled state, error box with Retry, 403 message,
  remembered date range in `localStorage` (try/catch, default 7 days).
  story: S8, S9 (AC4) · depends-on: T14, T15, T16, T17, T18

## Finish

- [x] **T20** — End-to-end check and docs. On the demo site with a real provider key: generate
  chat usage via a prompt and an agent, confirm figures, model table, chart, feature split and
  panel; set `ElectricityZone` to `SWE` and confirm the drop. README gains install, configuration
  (`AICarbon` section) and method summary.
  story: S1–S9 · depends-on: T19

- [x] **T21** — v17 line. Create `v17/dev` (and `v17/main`) from `v18/dev`, switch Umbraco and
  Umbraco.AI ranges to `[17.0.0,17.999.999)`, `@umbraco-cms/backoffice` to `^17`, and confirm
  build, tests and a demo-site smoke on v17.
  story: — (release constraint from BRIEF) · depends-on: T20

## Follow-up (user feedback after the v18 build)

- [x] **T22** — Friendlier figures and a slimmer table (frontend only). Cards and table cells lead
  with a rounded central figure "≈ X unit" (midpoint of min and max, same unit rules as
  format-co2) with the range "min–max unit" in small text underneath; the chart keeps its band.
  Remove the by-model Status column: estimated rows show the figure; not-estimated rows show
  "Not estimated" in the CO2e cell with the reason (Unknown model / Not supported) as tooltip +
  sr-only text; the warning icon sits next to the CO2e figure. Tests updated.
  story: S1, S2 · depends-on: —

- [x] **T23** — Everyday equivalent (backend + API). Opt-in `AICarbon:ShowEquivalents` (default
  false). When on and the total max is above zero, the estimate carries one equivalent based on
  the **max** CO2e: under 250 g → smartphone charges (12.4 g CO2 per charge, US EPA GHG
  Equivalencies Calculator, October 2024 revision; CO2 only); under 50 kg → km by average car (0.16725 kg CO2e/km, UK DESNZ GHG
  conversion factors 2025, "Average car, unknown fuel"); otherwise → km of short-haul flight per
  passenger (0.12786 kg CO2e/passenger-km incl. radiative forcing, same DESNZ 2025 set). Factors,
  sources and years live in one Core class. API adds `total.equivalent` (null when off) with kind,
  amount (raw), source name, source year. Unit and integration tests; OpenAPI doc still generates.
  story: new S10 · depends-on: —

- [x] **T24** — Show the equivalent (frontend). Regenerate the client; under the CO2e card show
  "Up to about {rounded amount} {phone charges / km by car / km flown}" (2 significant figures,
  localized), only when present; the method panel explains it uses the top of the estimate and
  names each factor with its source and year. Tests.
  story: new S10 · depends-on: T23
