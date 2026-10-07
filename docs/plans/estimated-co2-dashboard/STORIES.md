# Stories

Roles used below:
- **AI admin**: a backoffice user with access to the AI section who looks at Umbraco.AI Analytics.
- **Site developer**: the person who installs the package and edits appsettings.

## Definition of Ready

> ASSUMPTION: starting-point agreement, correct if your team works differently.

- Role, capability and value are stated and not hollow.
- Given/When/Then criteria cover the happy path; sad paths are listed separately.
- Out of scope is explicit (inherits the brief's Non-goals).
- Passes INVEST, especially Small and Testable.

## Definition of Done

> ASSUMPTION: starting-point agreement.

- Every acceptance criterion passes as an executable spec (via `bdd-specs`), sad paths included.
- `dotnet build` / `dotnet test` on the slnx and `npm run build` are green.
- Anything on an entry point (controller, composer, manifest) is verified through the running
  demo site, not only unit tests.
- Lands on `v18/dev` first, then ported to `v17/dev` before release.

---

## Epic: Estimated CO2 dashboard

### S1 — See an estimated CO2 total for a period (M)

As an **AI admin**,
I want a "CO2" tab in Umbraco.AI Analytics showing the estimated CO2e of our AI usage for a period,
so that I have a rough sense of the environmental cost of the prompts and agents we run.

**Happy path**

AC1 — Tab appears after Dashboard
  Given the package is installed alongside Umbraco.AI
  When  the AI admin opens Analytics
  Then  a "CO2" tab is shown after the "Dashboard" tab

AC2 — Total is a range in CO2e
  Given chat usage of a model known to EcoLogits exists in the last 7 days
  When  the AI admin opens the CO2 tab with "Last 7 days" selected
  Then  the CO2e card leads with a rounded central figure ("≈ 60 g CO2e") and shows the low-to-high range in the same unit underneath

AC3 — Energy card
  Given the same usage
  When  the tab loads
  Then  the energy card shows a low-to-high range in Wh (or kWh)

AC4 — Requests estimated card
  Given the same usage
  When  the tab loads
  Then  the requests card shows the number of chat requests included in the estimate

AC5 — Formula matches EcoLogits
  Given a known model, output token count and request count, and the provider's default zone
  When  the estimate is calculated
  Then  the min and max CO2e match EcoLogits' own result for the same inputs within 1%
        (excluding the dropped latency cap)

AC6 — Input tokens don't change the result
  Given two usage sets identical except for input and cached tokens
  When  each is estimated
  Then  both give the same CO2e

AC7 — Date range changes the figures
  Given usage exists both 2 and 20 days ago
  When  the AI admin switches from "Last 7 days" to "Last 30 days"
  Then  the totals are reloaded for the new range

AC8 — Ranges are ordered
  Given any estimate
  When  it is returned by the API
  Then  every min is less than or equal to its max

**Sad path**

AC9 — Invalid range rejected
  Given an API call where `from` is after `to`
  When  `GET /estimate` is called
  Then  it returns 400 problem details naming the field

---

### S2 — See which models the CO2 comes from (S)

As an **AI admin**,
I want a by-model breakdown that also lists models it couldn't estimate,
so that I can see which models drive the figure and trust that nothing was hidden.

**Happy path**

AC1 — Row per model
  Given usage of two estimated models in the range
  When  the tab loads
  Then  the "By model" table has one row per model with requests, output tokens and a CO2e range

AC2 — Total equals sum of rows
  Given any estimate
  When  the API returns it
  Then  `total.co2eGrams` equals the sum of the estimated `byModel` rows (min with min, max with max)

AC3 — Matched-as shown
  Given a dated model id that EcoLogits knows by alias (e.g. `claude-sonnet-4-5-20250929`)
  When  the tab loads
  Then  the row shows the EcoLogits model it was matched as

AC4 — Warnings explained
  Given a closed model flagged `model-arch-not-released`
  When  the AI admin hovers its info icon
  Then  a plain-English note says the model's size isn't published so the range is wide

**Sad path**

AC5 — Unknown model listed, not dropped
  Given usage of a model EcoLogits doesn't know
  When  the tab loads
  Then  the model is listed with status "Not estimated (unknown model)" and no CO2e figure

AC6 — Not-estimated card
  Given at least one unknown model in range
  When  the tab loads
  Then  the "Models not estimated" card shows the count in a warning colour

AC7 — Non-chat capabilities listed
  Given embedding or image-generation usage in range
  When  the tab loads
  Then  it is listed with status "Not estimated (not supported)" and excluded from the total

---

### S3 — Match models served by hosting providers (M)

As a **site developer**,
I want models used through Amazon, Microsoft Foundry, OpenRouter and similar hosts to be recognised,
so that the dashboard isn't mostly "not estimated" on a real site.

**Happy path**

AC1 — Direct provider match
  Given usage recorded with provider `google` and a model EcoLogits lists under `google_genai`
  When  the model is resolved
  Then  it is matched to that EcoLogits model

AC2 — Hosted name normalised
  Given provider `amazon` and model id `us.anthropic.claude-sonnet-4-5-20250929-v1:0`
  When  the model is resolved
  Then  it is matched to the Anthropic `claude-sonnet-4-5-20250929` model (exact dated name wins)

AC3 — Slash-prefixed name normalised
  Given provider `openrouter` and model id `openai/gpt-4o`
  When  the model is resolved
  Then  it is matched to the OpenAI `gpt-4o` model

AC4 — Configured mapping wins
  Given `AICarbon:ModelMappings` maps `my-gpt-deployment` to `openai/gpt-4o`
  When  usage with model id `my-gpt-deployment` is resolved
  Then  it is matched to `openai/gpt-4o`, before any other rule runs

AC5 — Unmapped new provider still matched
  Given a provider id that isn't in `ProviderMappings` (e.g. a new `groq` provider)
  And   a model id EcoLogits knows under another provider
  When  the model is resolved
  Then  it is matched by name to that EcoLogits model

AC6 — Provider mapping from settings
  Given `AICarbon:ProviderMappings` maps `my-gateway` to `openai`
  When  provider `my-gateway` with model id `gpt-4o` is resolved
  Then  it is matched to the OpenAI `gpt-4o` model

AC7 — Ambiguous name prefers the hinted vendor
  Given a model id whose stripped name exists under more than one EcoLogits provider
  And   the id carries a vendor prefix (e.g. `mistralai/`)
  When  the model is resolved
  Then  it is matched under the hinted vendor

AC8 — Resolver chain is extensible
  Given a developer adds their own `IAICarbonModelResolver` via the collection builder
  When  a model is resolved
  Then  their resolver takes part in the chain in the order they registered it

**Sad path**

AC9 — Bad mapping target
  Given a configured mapping that points at a model EcoLogits doesn't have
  When  the model is resolved
  Then  it is reported as not estimated and a warning is logged naming the mapping

AC10 — Still ambiguous
  Given a stripped name that exists under two first-party EcoLogits providers and no vendor hint
  When  the model is resolved
  Then  it resolves to nothing and is reported as not estimated

---

### S4 — See the CO2 trend over time (S)

As an **AI admin**,
I want a chart of estimated CO2e over the selected period,
so that I can spot when usage spikes.

**Happy path**

AC1 — Range chart
  Given usage across several days in "Last 7 days"
  When  the tab loads
  Then  the chart shows a floating bar from min to max for each bucket, with a line through the middle estimate

AC2 — Buckets sum to total
  Given any estimate
  When  the API returns it
  Then  the `timeSeries` buckets sum to `total` (min with min, max with max)

AC3 — Gaps shown as zero
  Given a day in range with no usage
  When  the API returns the time series
  Then  that bucket is present with zero CO2e

AC4 — Granularity follows the range
  Given "Last 24 hours" is selected
  When  the tab loads
  Then  the chart shows hourly buckets; for "Last 30 days" it shows daily buckets

---

### S5 — Split CO2 by prompts vs agents (S)

As an **AI admin**,
I want the estimate broken down by feature (agents, prompts, inline use, other),
so that I can see how much of the footprint comes from our agents specifically.

**Happy path**

AC1 — Feature rows
  Given usage from agents and prompts in range
  When  the tab loads
  Then  the "By feature" table shows a row for each with its CO2e range and request count

AC2 — Other bucket
  Given usage with a feature type the package doesn't know
  When  the estimate is calculated
  Then  it is counted in an "Other" row

AC3 — Features sum to total
  Given any estimate where the split is available
  When  the API returns it
  Then  `byFeature.items` sum to `total`

**Sad path**

AC4 — Feature dimension off
  Given Umbraco.AI's `IncludeUsageFeatureTypeDimension` is false
  When  the tab loads
  Then  the "By feature" area says the breakdown is switched off in Umbraco.AI analytics settings

---

### S6 — Choose the electricity region (S)

As a **site developer**,
I want to set one electricity region for the whole site,
so that the estimate reflects where our AI provider actually runs, if I know it.

**Happy path**

AC1 — Provider default
  Given no `AICarbon:ElectricityZone` is set
  When  an Anthropic model's usage is estimated
  Then  EcoLogits' Anthropic default zone (`USA`) and PUE are used, and the API reports `zoneIsOverride: false`

AC2 — Override applies
  Given `AICarbon:ElectricityZone` is `SWE`
  When  usage is estimated
  Then  Sweden's electricity mix is used for every model and the API reports `zoneIsOverride: true`

AC3 — Cleaner region, lower figure
  Given the same usage
  When  it is estimated with zone `SWE` and then with `USA`
  Then  the `SWE` estimate is lower

**Sad path**

AC4 — Unknown zone falls back
  Given `AICarbon:ElectricityZone` is `XYZ`
  When  the site starts and usage is estimated
  Then  a warning is logged and the provider default zone is used, and the API reports the zone actually used

---

### S7 — Understand how the estimate is worked out (S)

As an **AI admin**,
I want a plain-English explanation of the method,
so that I can judge how far to trust the figures and explain them to others.

**Happy path**

AC1 — Panel opens
  Given the CO2 tab is open
  When  the AI admin clicks "How is this calculated?"
  Then  a sidebar panel opens explaining what is and isn't counted

AC2 — Zone and data version shown
  Given any estimate
  When  the panel is open
  Then  it shows the electricity zone used, whether it is an override, and the EcoLogits data version

AC3 — Credit and notice
  Given the panel is open
  When  the AI admin reads it
  Then  it credits EcoLogits (MPL-2.0) with a link and says the package is unofficial, not Umbraco HQ

---

### S8 — Clear states when there's nothing, it's loading, or it fails (S)

As an **AI admin**,
I want the tab to tell me what's going on in every state,
so that I'm never left looking at a blank or broken screen.

**Happy path**

AC1 — Loading
  Given the estimate is being fetched
  When  the tab first opens
  Then  a loader bar is shown

AC2 — Reloading keeps old figures
  Given figures are on screen
  When  the AI admin changes the date range
  Then  the old figures stay visible but dimmed until the new ones arrive

AC3 — Remembers last range
  Given the AI admin chose "Last 30 days" earlier
  When  they come back to the tab later
  Then  "Last 30 days" is selected

AC4 — Default range
  Given no remembered range (or browser storage is unavailable)
  When  the tab opens
  Then  "Last 7 days" is selected

**Sad path**

AC5 — No usage
  Given no AI usage in the range
  When  the tab loads
  Then  it says "No AI usage in this period yet" and suggests a wider range

AC6 — Analytics disabled
  Given Umbraco.AI analytics are switched off
  When  the tab loads
  Then  it explains that analytics are off so there is nothing to estimate

AC7 — Load failure
  Given the API call fails
  When  the tab loads
  Then  an error box says the estimate couldn't be loaded, with a Retry button that tries again

---

### S9 — Only AI-section users can see the figures (S)

As an **AI admin**,
I want the CO2 figures protected the same way as the rest of Analytics,
so that usage details aren't exposed to users without AI access.

**Happy path**

AC1 — Access allowed
  Given a backoffice user with AI section access
  When  they call `GET /estimate`
  Then  it returns 200

**Sad path**

AC2 — Not signed in
  Given no backoffice session
  When  `GET /estimate` is called
  Then  it returns 401

AC3 — No AI section access
  Given a backoffice user without AI section access
  When  they call `GET /estimate`
  Then  it returns 403

AC4 — Forbidden message in UI
  Given the API returns 403 to the tab
  When  the tab loads
  Then  it says "You need access to the AI section to see this"

---

## Later (placeholders, not planned)

- Per-connection electricity regions.
- Estimates for embeddings and image generation, once a credible method exists.
- Switch to Umbraco.AI's own analytics elements if they become public exports.

### S10 — Relate the CO2e to something everyday (S, on by default)

As an **AI admin**,
I want an everyday comparison (on by default, can be turned off) for the estimated CO2e,
so that the figure means something to people who don't think in grams.

AC1 — On by default
  Given `AICarbon:ShowEquivalents` is not set
  When  the tab loads
  Then  the comparison is shown (set it to false to hide it)

AC2 — Based on the top of the estimate
  Given the setting is on and the estimate is 48–77 g CO2e
  When  the tab loads
  Then  the comparison uses 77 g and reads "Up to about 6.3 phone charges" (rounded up, never down)

AC3 — Scale-appropriate comparison
  Given the setting is on
  When  the top of the estimate is under 250 g / under 50 kg / 50 kg or more
  Then  the comparison is phone charges / km by car / km flown respectively

AC4 — Sources shown
  Given the setting is on
  When  the AI admin opens "How is this calculated?"
  Then  the panel names the source and year of the factor used and says the comparison uses the top of the estimate
