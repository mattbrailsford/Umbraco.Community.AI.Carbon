# Brief

## Problem

**What.** Umbraco.AI's Analytics section shows requests, tokens, success rate and duration, but
says nothing about the environmental cost of that usage. A site admin who wonders "how much CO2
are our agents and prompts using?" has no answer today short of exporting numbers and doing
the maths by hand with an outside calculator.

**Who it's for.**
- Primary: Umbraco backoffice users who already look at the Umbraco.AI Analytics section
  (admins, developers, agency leads).
- Secondary: the Umbraco community as an audience for a showcase of what a third-party package
  can build on top of Umbraco.AI's public analytics.
- Not for: editors doing day-to-day content work, front-end site visitors, or anyone needing
  audit-grade emissions reporting (CSRD/ESG filings).

**Why now.** A fun side project and showcase: it demonstrates that Umbraco.AI's analytics are
extensible by a community package without core changes. Not driven by a customer request.

> ASSUMPTION: It will likely surface in a blog post or talk, so the first release should be
> visually polished and easy to install, even if the feature set is small.

**What success looks like.**
- Installing the package adds a "CO2" (or similar) tab next to "Dashboard" in the Umbraco.AI
  Analytics section, with no changes to Umbraco.AI itself.
- For a chosen date range, it shows an estimated CO2 figure (with a low-to-high range) for all
  text-generation usage, plus a breakdown by model and a trend over time.
- Every figure is labelled as an estimate, and the page explains in plain words how it was
  worked out and where the data comes from.
- Models it can't estimate are listed as "not estimated", never silently counted as zero.

> ASSUMPTION: Showing a per-model and per-feature (prompt vs agent) breakdown counts as the
> "wow" part; a single total on its own is not enough for the showcase.

**Hard constraints.**
- Supports Umbraco CMS 18 and 17 from the first release, on separate `v18/dev` and `v17/dev`
  lines (same model as Umbraco.AI and Content Checks).
- Depends on `Umbraco.AI.Core` as a NuGet package on a version range per major. No changes to
  Umbraco.AI are required to ship.
- Unofficial community package. All wording must say "estimated", explain the method, and keep
  the "not Umbraco HQ" notice. No claims of savings or offsets.
- Estimation data reused from EcoLogits (GenAI Impact, MPL-2.0). Any file copied or ported from
  it stays MPL-2.0 and keeps its notice; the rest of the package stays MIT.

**Facts checked in Umbraco.AI (both lines).**
- `IAIUsageAnalyticsService` is public and offers summary, time series and breakdowns by
  provider, model, profile and user. The v17 and v18 copies match; only internal background jobs
  differ.
- `GetSummaryAsync` and `GetTimeSeriesAsync` accept an `AIUsageFilter` (provider, model,
  profile, capability, user, entity type, feature type) and return input, cached input and
  output tokens.
- The breakdown methods take no filter and return only total tokens, not the input/output
  split. So per-model output tokens mean one filtered summary call per model.
- Usage is kept as hourly stats for 30 days (max 90) and daily stats for 365 days. Analytics can
  be switched off entirely (`Enabled = false`), in which case there is nothing to estimate.
- Recorded capabilities include chat, embeddings and image generation; the stored model id is
  whatever string the provider uses.
- The Analytics screen is a standard workspace (`UmbracoAI.Workspace.AnalyticsRoot`), so a
  package can add a workspace view to it. The alias is a plain string, not an exported constant.

**Riskiest unknowns.**
1. **Model name matching.** Umbraco.AI stores the provider's model id (e.g. dated variants,
   Bedrock or Foundry-style names). EcoLogits keys models by provider + name. How many real
   model ids will match, and how gracefully do near-misses fall back?
2. **Provider coverage.** EcoLogits covers OpenAI, Anthropic, Google, Mistral, Cohere and
   Hugging Face. Umbraco.AI has 14 providers (Amazon, Microsoft Foundry, DeepSeek, OpenRouter,
   etc.), often serving the same underlying models under another provider's name.
3. **Non-text capabilities.** EcoLogits targets text generation. Embeddings and image
   generation probably can't be estimated with the same method.
4. **Data centre region.** The electricity mix (grams of CO2 per kWh) depends on where the call
   ran, which we usually don't know.
5. **Input tokens.** > ASSUMPTION: EcoLogits' energy model is driven mainly by output tokens
   (and generation latency), not input tokens. To verify, since it decides whether cached
   tokens matter at all.
6. **Honest ranges.** Closed-model sizes are guesses with wide min-max ranges. The UI must make a
   10x range read as "rough" without making the whole page feel useless.

**Smallest shippable version.**
> ASSUMPTION: One "CO2" tab in Analytics, chat/text-generation only, using the existing date
> range: an estimated total with a low-to-high range, a by-model table (including a "not
> estimated" row), a by-feature split (prompts vs agents vs other), a trend chart, and a "how this is calculated" panel. One global electricity
> mix setting (defaulting to a world average), configurable in appsettings.

**What would kill it.**
> ASSUMPTION: If most real-world model ids can't be matched to an estimate (so the page is mostly
> "not estimated"), or if MPL-2.0 reuse of EcoLogits data turns out to be a problem, the idea is
> shelved or reduced to a blog post rather than a package.

**Settled scope calls.**
- The first release breaks figures down by feature (prompts vs agents vs other) as well as by
  model, using the `FeatureType` usage filter. The original ask was about agent calls
  specifically.
- One global electricity-mix (region) setting for the whole site, in appsettings. No
  per-connection region in the first release.

## Non-goals

- **Audit-grade or compliance reporting.** No CSRD/ESG export, no certified figures. Estimates
  only, because the inputs (model sizes, data centres) aren't public.
- **Offsets, savings claims or "green" badges.** Avoids greenwashing risk for an unofficial
  package.
- **Changing Umbraco.AI.** The whole point of the showcase is that it works through public
  extension points. Small upstream improvements (e.g. exporting the workspace alias) are
  nice-to-haves, not blockers.
- **Training emissions.** Only inference (the calls the site makes) is in scope.
- **Live calls to an outside estimation API.** EcoLogits' hosted API is AGPL and would send
  usage data off-site; estimation runs locally.
- **Budgets, alerts or limits.** Showing figures only; no blocking or throttling of AI usage.
- **Per-connection or per-region electricity settings in the first release.** One global setting
  is enough for rough figures; per-connection regions can come later.
- **Embeddings and image generation in the first release.** Shown as "not estimated" until a
  credible method exists.
