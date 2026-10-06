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
