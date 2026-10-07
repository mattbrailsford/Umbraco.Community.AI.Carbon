---
name: gotcha-config-values-can-be-null
description: Bound config dictionary values can be null; never pass them straight into a Dictionary lookup or startup code
type: gotcha
---

`{"AICarbon":{"ProviderMappings":{"x":null}}}` binds to an entry whose value is `null`, even though
the property is `Dictionary<string, string>`. Passing it to `Dictionary.ContainsKey` throws, and in
startup code (notification handlers on `UmbracoApplicationStartingNotification`) that stops the site.

**Why:** found in T2 review; one appsettings typo would have taken the site down.
**How to apply:** treat every bound config string as possibly null or blank (`string.IsNullOrWhiteSpace`)
before using it, and wrap startup-time checks in a catch that logs. Test bad values by binding real JSON
(`AddJsonStream`), not only hand-built option objects.
