---
"gtm-mcp-worker": patch
---

Stop the repeated Google sign-in prompts: never issue an MCP token that outlives the Google token behind it, keep sessions through transient Google errors, stop a second login from revoking a client's other sessions, scope `gtm_remove_session` to the calling client, and remove the unauthenticated `/remove` endpoint.
