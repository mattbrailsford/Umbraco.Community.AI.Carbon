---
name: gotcha-nunit-fixture-instance-shared
description: NUnit reuses one fixture instance for all its tests; build per-test state in [SetUp], not field initializers
type: gotcha
---

NUnit creates a single instance per `[TestFixture]` and runs every test on it. A mock or options object
created in a field initializer is shared, so one test's changes or recorded calls leak into the next.

**Why:** happened twice while building T2 (shared options, shared mock logger) and caused false failures.
**How to apply:** create mocks, options and other mutable arrange state in `[SetUp]` (or a fresh local),
never in field initializers, in every nested Given-fixture.
