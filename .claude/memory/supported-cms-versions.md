---
name: supported-cms-versions
description: Package supports Umbraco CMS 18 and 17 on separate v18/dev and v17/dev lines, no forward-merge
type: decision
---

The package ships for Umbraco CMS 18 and 17 from the first release. Each major has its own
`vN/dev` / `vN/main` line, each depending on the matching `Umbraco.AI.Core` range
(`[18.0.0,18.999.999)` / `[17.0.0,17.999.999)`). Lines are maintained independently, like
Umbraco.AI and Content Checks.

**Why:** Umbraco.AI is actively supported on both v17 (LTS) and v18, and the user chose to
match that from day one.
**How to apply:** every feature or fix lands on one line and is ported to the other. The v17 line
was cut from `v18/dev` (07-10-2026) and differs in the Umbraco ranges, the OpenAPI registration
(Swashbuckle on CMS 17), the generated client's enum type names (`...Model` suffix) and the
integration-test host setup. See the T21 entry in `docs/plans/estimated-co2-dashboard/DECISION-LOG.md`.
