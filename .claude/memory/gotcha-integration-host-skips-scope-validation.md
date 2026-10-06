---
name: gotcha-integration-host-skips-scope-validation
description: UmbracoIntegrationTest has no scope validation and runs no composers; the TestServer base does run composers, so don't register them twice
type: gotcha
---

`UmbracoIntegrationTest` sets the hosting environment to "Tests", so `ValidateScopes` and
`ValidateOnBuild` are off. A singleton that captures a scoped service passes the integration tests.
`UmbracoIntegrationTest` also doesn't run composers. The TestServer base (`UmbracoTestServerTestBase`,
used via `ManagementApiTest<T>`) *does* run composers from referenced assemblies, so calling
`AddAICarbonWeb()` there as well registers the OpenAPI document twice and breaks document generation
("same key 401").

**Why:** found in T6 review; composer detail corrected in T12.
**How to apply:** verify any lifetime or composer change by booting the demo site with
`dotnet run --launch-profile DemoSite` (Development, validation on), and unit-test registration
logic with a real `UmbracoBuilder` + `Build()`.
