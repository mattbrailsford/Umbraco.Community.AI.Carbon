---
name: gotcha-v17-test-host-builds-ef-options-early
description: On CMS 17 the Management API test host builds Umbraco.AI's EF options before the test DB is set; remove Umbraco.AI's hosted jobs in the fixture
type: gotcha
---

On CMS 17, `UmbracoTestServerTestBase` instantiates all hosted services before `UseTestDatabase` runs
(in a hosted service's `StartingAsync`). Umbraco.AI's background jobs depend on its EF Core repositories,
so the pooled `UmbracoAIDbContext` options are built with an empty connection string and every query throws
"No database provider has been configured for this DbContext".

**Why:** found in T21 (v17 line). The v18 host does not show it.
**How to apply:** Management API fixtures call `builder.Services.RemoveUmbracoAIBackgroundJobs()`
(`tests/Umbraco.Test.AI.Carbon.Integration/UmbracoAITestHostExtensions.cs`) in `CustomTestSetup`. Real sites
are unaffected.
