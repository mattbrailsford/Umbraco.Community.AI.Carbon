# Decision log

- 06-10-2026: Built as a community package, not in Umbraco.AI core. Keeps third-party data, MPL
  licence and greenwashing risk out of the official product.
- 06-10-2026: Reuse EcoLogits data (MPL-2.0) and port its formula to C#. No mature .NET library
  exists; its hosted API is AGPL and would send usage data off-site.
- 06-10-2026: Support CMS 18 and 17 from the first release (user decision), on separate vN lines.
- 06-10-2026: Purpose is a showcase/side project, not a customer request. No audit-grade
  reporting.
- 06-10-2026: First release includes a by-feature split (prompts vs agents vs other) alongside
  by-model, because the original ask was about agent calls and the usage filter supports it.
- 06-10-2026: One global electricity-mix setting only; per-connection regions deferred. Figures
  are rough either way, so the extra setup isn't worth it yet.
- 06-10-2026: UI is a workspaceView on UmbracoAI.Workspace.AnalyticsRoot. Rejected a separate
  section or dashboard (wrong place) and editing the Usage dashboard (needs Umbraco.AI changes).
- 06-10-2026: No persistence; compute on read from IAIUsageAnalyticsService. Rejected a CO2 table
  plus background job (duplicates Umbraco.AI's history, goes stale when reference data updates).
- 06-10-2026: Default electricity zone follows EcoLogits' per-provider config (mostly USA), with one
  global AICarbon:ElectricityZone override. Refines the brief's "world average" guess so figures
  match EcoLogits' own calculator.
- 06-10-2026: Dropped EcoLogits' measured-latency cap: Umbraco.AI's time series has no duration.
- 06-10-2026: Own UUI + Chart.js components. Umbraco.AI's analytics elements are internal (not in
  exports.ts); using their tags would break silently on refactor.
- 06-10-2026: Model matching as an IAICarbonModelResolver chain (config mapping, direct provider,
  normalized name). Rejected one monolithic matcher.
- 06-10-2026: API reuses Umbraco.AI's SectionAccessAI policy, so Web depends on Umbraco.AI.Web.
- 06-10-2026: Usage is read per (provider, model) pair via filtered summaries, because the by-model
  breakdown groups on model id only. Found while writing specs.
- 06-10-2026: Specs are written as *.pending.* files excluded from compilation, renamed by the
  builder per task. Keeps the solution green while specs reference types that don't exist yet.
- 06-10-2026: Frontend specs cover pure logic modules with Vitest (as Umbraco.AI does); rendered
  elements are verified on the demo site in T13/T19. Adds vitest + happy-dom as dev dependencies.
- 06-10-2026: Pin EcoLogits 0.11.2 (released 29-09-2026) for data and reference test values.
- 06-10-2026: Provider map moved from code to `AICarbon:ProviderMappings` (shipped defaults,
  appsettings can add or replace), and the name-match resolver applies to any provider instead of
  a named list. New Umbraco.AI providers or EcoLogits vendors no longer need a package release.
- 06-10-2026: (T1) EcoLogits aliases are copies whose Name is the alias, as in EcoLogits'
  model_repository.py; GetModels() includes them (348). Lookups are case-insensitive (deviation).
  Alias with a missing target or colliding name is skipped; a count test catches it on data updates.
- 06-10-2026: (T1) Spec ModelResolverChainTests line 62 must expect the dated name for a dated id
  (exact match wins); T4 fixes the spec. FindModelsByName order is Provider then Name.
- 06-10-2026: (T2) Validation runs on UmbracoApplicationStartingNotification, wrapped in a catch
  that logs, so config mistakes never stop the site. Blank ElectricityZone counts as unset (T9 must match).
- 06-10-2026: (T2) Assigning ProviderMappings in code replaces the defaults; config binding merges.
  Dictionary setters copy into case-insensitive dictionaries. ModelMappingTarget.TryParse trims and
  splits at the first slash; T4's ConfiguredMappingResolver must reuse it.
- 06-10-2026: (T3) Calculator types are internal; ranges use EcoLogits' two-corner evaluation (low
  corner + PUE.min, high corner + PUE.max). Aggregated (O, R) equals the sum of R uncapped EcoLogits
  calls for any token split, so per-bucket totals are exact apart from the dropped latency cap.
- 06-10-2026: (T3) Invalid hand-built models (tps <= 0, negative ttft, non-positive or inverted
  ranges, NaN) throw ArgumentOutOfRangeException. T5 must catch this per model and report the model
  as not estimated rather than fail the whole estimate.
- 06-10-2026: (T3 review) Each request adds a ttft cost even with zero output, so T5/T7 should use
  successful request counts, not totals including failures.
- 06-10-2026: (T4) Exact dated ids match the dated EcoLogits model; spec and S3 AC2 updated.
- 06-10-2026: (T4) ModelMappings keys may omit the `:N` suffix (config binding drops keys with `:`);
  the resolver retries without it, then without the version suffix, then fully stripped.
- 06-10-2026: (T4) The resolver collection catches per resolver (logs once per type) so a broken
  custom resolver can't break the CO2 tab. Vendor hints use their own VendorAliases map.
- 06-10-2026: (T4) Fallbacks after all exact attempts: digit dots to hyphens (OpenRouter Claude ids)
  and a trailing -Turbo (Together). Mapping changes need an app restart (IOptions on singletons).
- 06-10-2026: (T5 review) Known upstream behaviour inherited from Umbraco.AI: with Daily granularity,
  today's already-aggregated hours are missing until the daily rollup runs (raw records are deleted
  after hourly aggregation). The CO2 tab matches the Usage dashboard; T7/T20 should expect it.
- 06-10-2026: (T5 review) Requests count successes only; output tokens include failed requests'
  tokens (generated tokens used energy anyway). Model ids differing only by case may double count on
  SQL Server (case-insensitive filters vs ordinal breakdown grouping); accepted as rare.
- 06-10-2026: (T5) Granularity auto-pick duplicates Umbraco.AI's rule (<= 7 days hourly) and is passed
  explicitly to every call. GetEstimateAsync throws ArgumentException when from >= to (T11 returns 400 first).
- 06-10-2026: (T5) One (provider, model) pair can give two rows (chat estimated + unsupported non-chat);
  the frontend row key is ProviderId + ModelId + Status. ByFeature reports Available=false until T8.
- 06-10-2026: (T6) All services singletons (Umbraco.AI's analytics service is a singleton). No
  ComposeAfter needed (resolution is lazy). Integration tests reference Umbraco.AI.Startup (test
  project only) for AddUmbracoAI() and run Umbraco.AI's migration handler in SetUp.
- 06-10-2026: (T7) Per-model totals are derived from the time-series buckets so the series always
  sums to the total. A non-aligned `from` drops the partial first bucket, matching Umbraco.AI.
- 06-10-2026: (T7 review) Window limits: Hourly <= 93 days, Daily <= 1,830 days (orchestrator call,
  covers raised hourly retention and ~5 years daily; UI only offers 24h/7d/30d). Service throws,
  T11 returns 400. Inputs normalised to UTC. Brief NotEstimated drift when a request lands between
  the summary and series reads is accepted as transient.
- 06-10-2026: (T7 review) T11 must reject dates that would overflow bucket arithmetic (e.g. `to` near
  DateTime.MaxValue) before calling the service.
- 06-10-2026: (T8) byFeature is unavailable when analytics are disabled as well as when the feature
  dimension is off. Frontend: check method.analyticsEnabled first (whole-view message, S8 AC6); show
  the "switched off" note (S5 AC4) only when analytics are on and byFeature.available is false.
- 06-10-2026: (T8 review) Known chat feature types verified against all producers: agent (also
  Copilot, Workspace, Automate), inline-agent, prompt, inline-chat (also guardrail/judge/chat API).
  Agent selector calls carry no feature type and land in Other. v17 port: check InlineAgent exists
  in the 17.0.0 floor package.
- 06-10-2026: (T8) Other = per-model integer residual (chat successes/tokens minus known types), then one Apply per model, so floating-point drift between bucket and summary sums can never create an Other row.
- 06-10-2026: (T9) Zones can differ per provider (mistralai SWE, most USA), so each estimated row
  carries electricityZone, method.electricityZones lists the zones used, and method.electricityZone is
  the override, else the single shared zone, else null. Override read once per estimate via
  IOptionsMonitor; factor cache keyed on model + zone. Untrimmed override values count as unknown.
- 06-10-2026: (T9 review) For T10: include the resolved zone override in the result cache key, so a
  config change isn't hidden for 5 minutes. Unknown zones log once at startup and once at first use.
- 06-10-2026: (T10) Cache key uses exact UTC ticks. The frontend (T14/T19) must align its window to
  the bucket boundary (hourly: `to` = start of the next UTC hour, `from` = `to` minus the range; daily:
  next UTC midnight) or the cache never hits. Mappings are left out of the key (restart-only).
- 06-10-2026: (T11) Integration endpoint tests need two test-only workarounds: set Umbraco's static
  GlobalSetupTeardown.TestConfiguration by reflection (the TestServer base has no hook) and copy
  deps.json as Umbraco.Tests.Integration.deps.json. Both fail loudly if Umbraco changes. The fixture
  derives from ManagementApiTest<BackOfficeController> only for its sign-in helpers.
- 06-10-2026: (T11) Exact 7-day windows are Hourly (Umbraco.AI rule: more than 7 days is Daily).
- 06-10-2026: (T11 review) v17 port (T21): the OpenAPI registration and schema transformer are CMS 18
  (Microsoft.AspNetCore.OpenApi) APIs; v17 needs the Swashbuckle equivalents as in Content Checks v17.
- 06-10-2026: (T11 review) The OpenAPI document is only generated on a running site, so T12 must check it generates (generate-client against the demo site) and add a cheap test via IOpenApiDocumentProvider if it works in the test host.
- 06-10-2026: (T12) Abort signals go to the generated client (`signal`), not only tryExecute's abortSignal, which cannot cancel hey-api promises. app.ts keeps `export * from "./index.js"` until the package gets an importmap entry or public API.
- 06-10-2026: (T13) Tab icon is icon-cloud (no leaf icon in the CMS set). Header row should use uui-box's header-actions slot; the view keeps a _range state so T14/T19 only set it and call #load().
- 06-10-2026: (T14) Card grid matches Umbraco.AI's Usage cards (auto-fit minmax(250px)), so 3+1 wrapping at
  ~900px is accepted. Number style for all components: English formatting with thousands separators
  (Intl.NumberFormat "en"), matching the en dictionary; backoffice-culture formatting is a later idea.
- 06-10-2026: (T15) The by-model table shows each row's electricity zone. Zones differ per provider
  (T9), so the table is the only place a mixed-zone estimate is visible row by row; the method panel
  (T18) still summarises the zones used. Missing values show an em dash; warnings use `title` +
  aria-label on a focusable icon (the backoffice has no tooltip component).
- 06-10-2026: (T16) Chart is a min/max band with no mid line (a midpoint is not an estimate), UTC labels, single y unit from the series max. Colour from --uui-color-default; dark contrast is 2.53:1, so T17 switches to --uui-color-default-emphasis (passes 3:1 in both themes).
- 06-10-2026: (T18 review) Credit corrected: EcoLogits 0.11.2 is part of the CodeCarbon non-profit
  (started by GenAI Impact); repo moved to github.com/mlco2/ecologits. Earlier plan docs that say
  "GenAI Impact" are historical. The zone hint must say to set the zone only to where models really
  run, so the setting can't be used to lower figures. Panel copy needs a human read before release
  (external-facing text).
- 06-10-2026: (T19) A failed reload replaces the old figures with the error box (they belong to the previous range). Vitest runs with --no-experimental-webstorage because Node 25+ ships a localStorage global that shadows happy-dom's.
- 06-10-2026: (T20, user decision) The end-to-end check uses seeded hourly usage in the demo DB
  (505 rows: dated Claude id, gpt-4o-mini, Bedrock Claude id, unknown fine-tune, embeddings across
  agent/prompt/inline-chat) instead of real provider calls. Checked in the browser: cards, chart,
  by-model (Bedrock match, not-estimated rows), by-feature, method panel, range memory and the
  analytics-off state. A run with real AI calls is left for the user to try.
- 06-10-2026: (T20) README links to THIRD-PARTY-NOTICES and LICENSE point at blob/v18/main (404 until the first release). Release checklist: update the pre-release banner and confirm those links.
- 06-10-2026: (T21, user decision) Open the v18 PR first; after it merges, create v17/dev from v18/dev and port on its own branch with its own review (CMS 17 uses Swashbuckle, older Umbraco.AI/backoffice APIs; check InlineAgent in the 17.0.0 floor).
- 06-10-2026: (Layout follow-up, user request) The CO2 tab now mirrors Umbraco.AI's Usage dashboard
  layout: no outer box, page header on the background, compact cards (descriptions as tooltip +
  hidden text), chart and each table in their own uui-box, Title Case headings and labels. This
  supersedes T13 (header in the uui-box header-actions slot) and T14 (auto-fit grid accepting 3+1):
  the four cards now show 4 across, 2x2 or 1 column via a container query. Tables stay stacked full
  width (by-model has 7 columns). Chart style and the method button are unchanged.
- 06-10-2026: (User request) Tables run edge to edge inside their boxes (no box padding or inset
  rounded table border), unlike Umbraco.AI's inset breakdown tables. The method button becomes an
  icon-only button with an accessible label and tooltip. Status tags shortened to Estimated /
  Unknown Model / Not Supported, with the longer explanation in a tooltip and hidden text.
- 06-10-2026: (User request) Summary card icons use --uui-color-default-emphasis (the chart's blue) instead of Umbraco.AI's pale --uui-color-current pink, for readability.
- 06-10-2026: (User feedback) Lead with a rounded central figure ("≈", midpoint) and keep the range
  in small text; drop the Status column (reason shown in the CO2e cell); add an opt-in everyday
  equivalent based on the max CO2e worded "up to about", per the conservativeness principle (never
  understate). Factors read directly from the DESNZ 2025 condensed set spreadsheet and the US EPA
  calculator; mixing a UK and a US source is accepted and named in the panel.
- 06-10-2026: (T23 review) EPA smartphone factor is from the October 2024 revision (not 2025) and is CO2 only; source year comes from the API and is never hardcoded in the UI. DESNZ source named by its official title.
- 06-10-2026: (T24 review) "Up to" amounts round UP to 2 significant figures (never understate);
  below 1 phone charge reads "Less than one phone charge". The panel names only the factor in use
  (the only one the API returns). The comparison sits in its own thin full-width strip below the
  cards (user request), not inside the CO2e card. DESNZ source string shortened to the publication
  title so the panel reads naturally.
- 06-10-2026: (user feedback) The comparison now reads as an activity, which is more exact:
  "Up to about the same as charging a phone {amount} times", "...driving {amount} km in an average
  car", "...flying {amount} km (short-haul, per passenger)". Under one charge it reads "Less than
  charging a phone once". Supersedes the "phone charges / km by car / km flown" wording in T24.
- 07-10-2026: (CTO feedback) Header now reads "Estimated CO2e from AI Inference" with a scope line:
  "Covers the AI provider's servers and data centres for your chat requests. Your own servers,
  database and hosting are not included." Review rejected an earlier "the AI models running your
  requests" draft: it implied all request types and undersold the data-centre and hardware share.
  Method panel and README "not counted" lists now name your own servers, database and hosting.
- 07-10-2026: (user) Scope line shortened to "AI provider side of chat requests only. Excludes your
  own servers, database and hosting." Keeps "chat" (no image/speech overclaim) and the exclusions.
- 07-10-2026: (CTO feedback) The T16 "min/max band with no mid line" choice is replaced by floating
  range bars (pale pink, translucent so gridlines show through) plus a smoothed (monotone) midpoint
  line labelled "Middle estimate", with a legend and a single-line tooltip "≈ X (min–max)". Reason:
  the CTO couldn't read the band, and the cards already lead with the midpoint "≈" figure. The legend
  is a key only (click-to-hide is off, since the tooltip reads from the range dataset). The tooltip
  picks its unit per bucket, like the cards; the axis uses one unit for the series.
- 07-10-2026: (user, dark mode) Range bars use a fixed pink, not --uui-color-current (blue in the
  dark theme): #ffe8e6 made translucent on light surfaces, rgba(255, 140, 150, 0.3) on dark ones.
  Chart text, grid and tooltip colours come from theme variables and re-resolve live when the
  backoffice theme changes (per-frame settle window plus a stylesheet load watcher).
- 07-10-2026: (T21, v17 line) Floors: `Umbraco.AI.*` `[17.0.0,17.999.999)` and `Umbraco.Cms*` `[17.4.0,17.999.999)`.
  Umbraco.AI 17.0.0 already has everything the package calls (`IAIUsageAnalyticsService`,
  `AIUsageFilter.FeatureType`, `Constants.FeatureTypes.InlineAgent`, `AIAuthorizationPolicies.SectionAccessAI`,
  the `UmbracoAI.Workspace.AnalyticsRoot` workspace), but its own dependency floor is CMS 17.4.0, so a
  lower CMS range fails restore (NU1605). The demo-site script detects the major from the `Umbraco.Cms`
  lower bound, so it installs the 17.4.0 template and `Umbraco.AI 17.*` into `demos/v17/` unchanged.
- 07-10-2026: (T21) OpenAPI on CMS 17 is Swashbuckle, not `Microsoft.AspNetCore.OpenApi`. The document is
  registered with `Configure<SwaggerGenOptions>` (`SwaggerDoc`, Umbraco's `MimeTypeDocumentFilter`, a
  `BackOfficeSecurityRequirementsOperationFilterBase` subclass) plus our own `OperationIdHandler`
  (action name, first letter lower-cased) and `SchemaIdHandler` (claims our namespace), because Umbraco's
  defaults only claim `Umbraco.Cms` types. Same document name and routes; served at
  `/umbraco/swagger/ai-carbon-management/swagger.json` (was `/umbraco/openapi/<name>.json`), so
  `generate-openapi.js` and the document tests use that URL. The v18-only HTTP JSON options bridge
  (`ConfigureAICarbonHttpJsonOptions`) is deleted on this line; Swashbuckle reads the MVC options.
- 07-10-2026: (T21) The regenerated client differs from v18 only cosmetically, except that the enum
  types gain Umbraco's `Model` suffix (`AiUsagePeriodModel`, `AiCarbonEstimateStatusModel`,
  `AiCarbonEquivalentKindModel`; `AIUsagePeriod` belongs to Umbraco.AI, whose own handler adds it, so it
  cannot be kept stable from here). Frontend references renamed to match; the rest is nullable ordering
  (`string | null`) and an index signature on `ValidationProblemDetails`.
- 07-10-2026: (T21) Frontend needed no API changes: every `@umbraco-cms/backoffice` import used exists in
  17.7.1 and the build and tests pass; range is `^17.4.0`: 17.0.0 lacks `localize.termOrDefault` and `UmbAuthContext.configureClient`, so the floor is 17.4.0 (installed 17.7.1).
- 07-10-2026: (T21) CMS 17's Management API test host instantiates every hosted service before
  `UseTestDatabase` points the app at the per-test database. Umbraco.AI's background jobs pull in its EF Core
  repositories, so EF Core caches `UmbracoAIDbContext` options with an empty connection string and every
  query fails ("No database provider has been configured"). The integration fixtures remove Umbraco.AI's
  hosted jobs from the test host (`RemoveUmbracoAIBackgroundJobs`); they have no part in those tests.
  The v18 host does not show this. A real site is unaffected (the connection string is in config at build).
- 07-10-2026: (T21) `version.json` unchanged (`0.1.0-alpha`, same scheme as the v18 line and Content
  Checks' v17 line; `publicReleaseRefSpec` already matches `vN/` branches).
- 07-10-2026: (user) The everyday comparison (`AICarbon:ShowEquivalents`) is now ON by default; sites
  that object set it to `false`. It was opt-in before because of the claim-like wording, the mixed
  sources (EPA CO2-only phone figure vs DESNZ CO2e for car and flight) and the pending wording review.
  Those reasons are noted and accepted by the user. Supersedes the opt-in default in T23 and S10.
- 07-10-2026: (user) Hourly chart labels and tooltips now use the viewer's local time zone (matching
  Umbraco.AI's Usage chart), with no "UTC" suffix. Daily buckets are UTC days, so their date is still
  formatted in UTC to avoid showing the wrong date west or east of UTC. Supersedes the T16 "UTC
  labels" choice. On the October DST fall-back two hourly ticks read the same; data is unaffected.
