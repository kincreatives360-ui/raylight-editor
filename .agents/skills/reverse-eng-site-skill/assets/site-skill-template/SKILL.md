---
name: SITE-SLUG
description: "Operate SITE through its verified internal API. Use when asked to OPERATIONS."
---

# SITE

Use the direct API client at `scripts/CLIENT`. Use browser interaction only to
recapture a changed request or refresh the authenticated session.

## Authentication

- Mechanism: AUTH-MECHANISM
- Programmatic source: AUTH-SOURCE
- Secret environment variables: ENV-VARS
- Verified: YYYY-MM-DD

## Operations

| Operation | Method and endpoint | Inputs | Validation |
|---|---|---|---|
| OPERATION | METHOD REDACTED-ENDPOINT | INPUTS | TWO-CANARY RESULT |

## Commands

```bash
COMMAND
```

## Evidence

- Capture action: ACTION
- Authenticated versus unauthenticated difference: DIFFERENCE
- Pagination stopping condition: CONDITION
- Known limits: LIMITS

## Repair

On 401 or 403, check session freshness and CSRF coupling. On endpoint or schema
drift, use `$reverse-eng-site-skill` to recapture one minimal action, replay it,
and update this file plus the client. Keep raw captures and secret values out of
the repository.
