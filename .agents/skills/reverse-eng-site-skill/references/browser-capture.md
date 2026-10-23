# Browser capture

Use this reference when choosing or repairing the network instrumentation path.

## Capture ladder

Choose the highest available rung:

1. Chrome DevTools Protocol or a browser tool that returns request and response
   bodies, headers, cookies metadata, initiators, and timing.
2. DevTools Network with Preserve log and Copy as cURL or Export HAR.
3. An in-page `fetch` or `XMLHttpRequest` interceptor armed before a shallow
   action.
4. Performance entries and framework state for candidate discovery only.

The first two rungs survive page logic better. An in-page interceptor disappears
on reload, can miss requests made before it was installed, and may miss a
framework's saved reference to `fetch`. Patch both `fetch` and
`XMLHttpRequest.prototype.open/send` when using this fallback. Capture navigation
and native-dialog mutations at the protocol layer.

## Isolation loop

1. Open the target page and confirm the visible account or entitlement.
2. Arm capture and clear the log.
3. Perform one minimal action.
4. Stop capture and filter to Fetch/XHR, GraphQL, documents with JSON bodies,
   WebSockets, or likely `/api`, `/graphql`, `/rpc`, and `/query` paths.
5. Inspect the response before performing another action.

Scroll or click only to answer a capture hypothesis such as “which request loads
page two?” A click sequence that merely completes the user's task produces no
reusable interface. Once the target request is identified, end UI navigation;
save the redacted UI canaries required by Step 2 during this capture phase so
later fidelity checks do not require returning to the interface.

## Auth acquisition ladder

Use the existing authenticated session without exposing secret values:

1. Replay with `fetch(..., {credentials: "include"})` inside the page.
2. Use the browser tool's cookies, storage, network, or authenticated request
   APIs.
3. Copy a captured request as cURL and replace secret values with environment
   variables before saving it.
4. Read the browser profile only when the toolchain can decrypt it safely.
5. Ask the user for manual extraction only after recording why each available
   programmatic path failed.

`httpOnly` blocks page JavaScript from reading a cookie value; it does not block
the browser from attaching the cookie or protocol-level tooling from observing
cookie metadata. Record cookie names and scopes in notes, not values.

When returning an in-browser `fetch` response, write the body to a file or a
page-scoped variable and read it in bounded chunks. Small return channels such
as the document title or one DOM attribute can truncate silently and corrupt
data.

## Capture hygiene

- Redact artifacts according to the
  [Secret boundary](security-and-validation.md#secret-boundary), including token
  query parameters, before writing them.
- Keep raw HAR files in a private temporary directory.
- Record header names and value shapes when exact values are secret.
- Avoid screenshots of cookie or token panels.
- Check redirects and service-worker responses; the visible URL may not be the
  data endpoint.
