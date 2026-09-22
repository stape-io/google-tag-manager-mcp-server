---
"google-tag-manager-mcp-core": patch
---

Add an internal test suite (regression harness, golden `tools/list` snapshot, schema and dispatch invariants) with no behavior change. Also fixes `package.json`'s `files` field, which was unintentionally shipping the new `src/test` sources (including a `vitest` import) inside the published npm tarball.
