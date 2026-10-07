---
name: gotcha-config-keys-cannot-contain-colon
description: .NET configuration treats ':' as a section separator, so dictionary keys containing ':' are silently dropped when bound
type: gotcha
---

Binding `{"AICarbon":{"ModelMappings":{"meta.llama3-1-70b-instruct-v1:0":"..."}}}` drops that key
without any error, because `:` separates configuration sections (env vars too). Model ids from Amazon
Bedrock always end in `-vN:N`.

**Why:** found in T4 review; admins could never map Bedrock ids by hand.
**How to apply:** any settings dictionary keyed by external ids must accept a colon-free form of the
key (and document it), and its tests must bind real JSON via `AddJsonStream`, not hand-built options.
