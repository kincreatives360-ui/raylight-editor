# Internal API protocol clues

Read the section matching the captured traffic.

## REST and JSON endpoints

Map path IDs, query parameters, method, encoding, and pagination. Look for a list
request followed by a detail request. Validate whether `limit` is capped and
whether an empty page, total, or cursor terminates pagination.

## GraphQL

Record `operationName`, variables, query text or persisted-query hash, endpoint,
and batch shape. A persisted hash may be coupled to a frontend release. Prefer a
captured operation over inventing a new query; some servers reject arbitrary
documents. Compare GraphQL `errors` even when HTTP status is 200.

## Framework RPC and batches

tRPC, Connect, JSON-RPC, and custom batch transports may encode operation names
in a path or query parameter and inputs in numbered JSON objects. Preserve batch
indexes and content type. Reduce to one operation only after an exact replay.

## Next.js Server Actions

Record the action identifier header, router state, origin, content type, and
serialized body. Action IDs can change with each deployment, so a durable client
needs a rediscovery path. Prefer a stable backing endpoint when capture shows one.

## WebSockets, SSE, and streams

Record the handshake plus the frame or event that carries the result. Identify
subscribe, cursor, heartbeat, and resume messages. Prove whether an initial HTTP
request supplies a token or channel ID. A durable client must bound collection
and terminate intentionally.

## Signed and anti-bot requests

Vary ordinary headers before attributing a failure to bot protection. Record the
specific changing signature, challenge cookie, device binding, or TLS/browser
dependency. When direct HTTP is genuinely browser-bound, apply the in-browser
`fetch` fallback from Step 3.
