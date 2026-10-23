# Security and validation

Use this reference before saving captures, testing writes, or claiming fidelity.

## Secret boundary

Treat cookies, bearer tokens, CSRF values, signed URLs, token query parameters,
request signatures, and private response bodies as secrets. Keep raw captures
temporary and outside the repository. Replace values with environment-variable
lookups in runnable code. Run a secret scan over tracked files before handoff.

## Permission boundary

Use only the account and data the user has authorized. Respect access controls,
rate limits, terms, and applicable law. Discovery does not authorize bypassing a
paywall, challenge, account boundary, or technical control. Stop when the desired
operation requires evasion rather than replaying the user's legitimate access.

## Read validation

For each sample, compare:

- HTTP status and redirect chain
- response byte length and content type
- stable top-level keys and item count
- the UI canary or canaries saved during Step 2
- completeness indicators such as full body length, entitlement fields, or
  continuation cursors

Run the same request without auth when safe. Record the measured difference.
Never infer full access from a successful status alone.

## Write validation

Capture a reversible UI write and replay it against one test object. Preserve
idempotency keys, CSRF coupling, and optimistic-concurrency fields. Verify with a
separate read. Use dry-run, test IDs, rate limits, and explicit confirmation for
bulk or destructive execution.

## Drift diagnostics

Classify failures before changing code:

- 401: expired or missing session
- 403: entitlement, CSRF, signature, or bot control
- 404: path, resource ID, tenant, or deployment drift
- 409/412: idempotency or concurrency conflict
- 2xx with missing fields: auth downgrade, schema drift, preview response, or a
  list/detail mismatch

Recapture one minimal action and update the site-specific artifact with the new
evidence date and request shape.
