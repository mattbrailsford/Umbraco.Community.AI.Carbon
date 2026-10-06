# Estimated CO2 Dashboard

Read these in order:

1. [x] **BRIEF.md** — Show site admins a rough, honest estimate of the CO2 behind their Umbraco.AI usage, as a new tab in the Analytics section.
2. [x] **ARCHITECTURE.md** — A "CO2" tab on Umbraco.AI's Analytics screen, computed on request from public usage data and a C# port of the EcoLogits formula; no database.
3. [x] **SPEC.md** — One protected GET /estimate endpoint returning ranged CO2e totals, by model, by feature and over time, plus the tab's cards, chart, tables, method panel and empty/error states.
4. [x] **STORIES.md** — 9 stories in one epic: total, by model, model matching, trend, by feature, region, method panel, screen states, access.
5. [x] **PLAN.md** — 21 tasks; first parallel group is T1 (EcoLogits data) + T2 (options). 13 pending spec files (8 C#, 5 TypeScript).
6. [x] **BUILD-LOG.md** — T1–T20 built and reviewed on v18 (40 commits incl. plan updates); T21 (v17 port) follows after the v18 PR merges.

See `DECISION-LOG.md` for why things changed along the way.
