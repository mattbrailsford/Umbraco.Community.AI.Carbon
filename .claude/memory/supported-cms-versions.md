---
name: supported-cms-versions
description: Package supports Umbraco CMS 19, 18 and 17 on separate v19/dev, v18/dev and v17/dev lines, no forward-merge
type: decision
---

The package ships for Umbraco CMS 19, 18 and 17. Each major has its own `vN/dev` / `vN/main`
line, each depending on the matching `Umbraco.AI.Core` range (`[19.0.0-rc.1,19.999.999)` /
`[18.0.0,18.999.999)` / `[17.4.0,17.999.999)`). Lines are maintained independently, like
Umbraco.AI and Content Checks.

**Why:** Umbraco.AI is actively supported on v17 (LTS), v18 and v19, and the user chose to
match that. The v19 line was cut from `v18/dev` on 13-11-2026 (CMS 19.0.0-rc1); see
`docs/upgrades/v19.md`.
**How to apply:** every feature or fix lands on one line and is ported to the others. From v19 the
dashboard is built on Umbraco.Analytics.UI and follows Umbraco.AI's header date range, so a UI
change on v19 usually doesn't port to v18/v17 as-is.
