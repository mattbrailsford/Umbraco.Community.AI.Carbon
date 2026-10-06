---
name: gotcha-integration-host-skips-scope-validation
description: UmbracoIntegrationTest runs in the "Tests" environment, so DI scope validation is off; only the demo site (Development) catches a singleton capturing a scoped service
type: gotcha
---

`UmbracoIntegrationTest` sets the hosting environment to "Tests", so `ValidateScopes` and
`ValidateOnBuild` are off. A singleton that captures a scoped service passes the integration tests.
The integration host also doesn't run composers, so composer-level behaviour (guards, ordering) is
never exercised there.

**Why:** found in T6 review.
**How to apply:** verify any lifetime or composer change by booting the demo site with
`dotnet run --launch-profile DemoSite` (Development, validation on), and unit-test registration
logic with a real `UmbracoBuilder` + `Build()`.
