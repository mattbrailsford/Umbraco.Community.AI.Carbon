# Memory index

One line per file in this folder, newest relevant first. See `README.md` for the format.
- [supported-cms-versions.md](supported-cms-versions.md) — CMS 18 + 17 on separate vN lines from the first release
- [gotcha-config-values-can-be-null.md](gotcha-config-values-can-be-null.md) — bound config values can be null; guard before lookups, never throw at startup
- [gotcha-nunit-fixture-instance-shared.md](gotcha-nunit-fixture-instance-shared.md) — NUnit shares one fixture instance; arrange in [SetUp]
- [gotcha-config-keys-cannot-contain-colon.md](gotcha-config-keys-cannot-contain-colon.md) — config dictionary keys with `:` are silently dropped; accept colon-free keys
- [gotcha-integration-host-skips-scope-validation.md](gotcha-integration-host-skips-scope-validation.md) — integration host has no scope validation or composers; smoke lifetimes on the demo site
- [gotcha-v17-test-host-builds-ef-options-early.md](gotcha-v17-test-host-builds-ef-options-early.md) — CMS 17 test host builds Umbraco.AI's EF options before the test DB; remove its hosted jobs in fixtures
