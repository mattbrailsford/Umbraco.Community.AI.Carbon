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
