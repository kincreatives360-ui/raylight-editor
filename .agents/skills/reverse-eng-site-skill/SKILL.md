---
name: reverse-eng-site-skill
description: "Reverse-engineer a website's undocumented internal API by instrumenting browser traffic, replaying captured requests as direct HTTP, proving auth and response fidelity, and packaging a resilient client or site-specific skill. Use when asked to discover, automate, wrap, download from, or repair an integration with a website that lacks a public API or MCP."
---

# Reverse Engineer Site APIs

Follow one transition: **instrument, then replay**. Use the logged-in browser as
an instrumented probe to establish state and provoke requests. As soon as the
target request is captured, end UI navigation and move execution to direct HTTP.
The browser may remain the authenticated transport for direct requests or
refresh authentication, but later steps do not resume clicking through the site.

## 1. Define the operation

Write one observable operation in this form:

`Given <state>, perform <action>, obtain <exact result>.`

Classify it as read-only or state-changing. For a state-changing operation,
choose a reversible test object and keep bulk execution outside discovery.

**Complete when:** the operation is classified read-only or state-changing, the
target result is explicit, and a state-changing operation has a reversible test
action.

## 2. Capture one request

Use the user's existing authenticated browser session. Start network capture
before the action, preserve the log, clear unrelated traffic, then perform the
smallest UI action that produces the result once. Prefer a DevTools Protocol or
HAR capture that includes request bodies and survives navigation.

Record:

- method, full URL, query parameters, status, and initiator
- request headers and body shape, with secret values redacted
- response content type, size, top-level shape, and two non-secret UI canaries
- whether cookies, authorization headers, CSRF tokens, or request signatures exist

If a HAR is available, run:

```bash
python <skill-dir>/scripts/har_candidates.py capture.har
```

Here and below, `<skill-dir>` means the directory containing this `SKILL.md`.

Write `capture.har` to a private temporary directory outside the repository. It
may contain unredacted cookies and tokens. Read the
[Secret boundary](references/security-and-validation.md#secret-boundary) before
storing it.

Read [references/browser-capture.md](references/browser-capture.md) when the
available browser tool hides bodies, loses events on navigation, or exposes
multiple ways to access the logged-in session.

**Complete when:** at least one captured request can plausibly account for the
exact target result and at least one UI canary has been saved. When the UI
exposes two, reserve one as a fidelity holdout and do not use it to select the
endpoint. Record when only one canary exists. A rendered page or DOM selector is
not request evidence.

## 3. Replay the request outside the UI

Start from the captured request, not a guessed endpoint. Reproduce it with
`curl`, `httpx`, or the site's native protocol. Preserve its method, encoding,
cookies, headers, and body exactly for the first replay. Use the browser's cookie
store or authenticated request context programmatically; exhaust those paths
before asking the user to copy a cookie.

Read [references/browser-capture.md](references/browser-capture.md) for the
ordered auth-acquisition ladder before asking the user for a cookie.

Compare capture and replay using status, byte length, stable keys, item count,
and the captured canary. When a browser-only anti-bot or signed request blocks
standalone HTTP, replay with `fetch` inside the authenticated browser and record
that constraint instead of substituting DOM automation.

**Complete when:** a repeatable command returns the same target data, or the
specific browser-bound requirement is demonstrated with request evidence.

## 4. Minimize and map

Remove nonessential headers one at a time. Vary one input at a time to map:

- identity and publication, workspace, account, or resource IDs
- pagination or cursors, sort, filters, search, and limits
- list, detail, download, and mutation endpoints
- REST, GraphQL operations, persisted queries, RPC batches, or streaming frames
- authentication lifetime, CSRF coupling, and refresh behavior

Compare authenticated and unauthenticated replays. A successful public list
request proves only that the list is public; it says nothing about full detail,
paid content, private fields, or mutations.

Read [references/protocols.md](references/protocols.md) when the request is
GraphQL, a framework RPC, a Server Action, a batch, or a stream.

**Complete when:** the smallest known request is documented and every input
needed for the user's operation has a known source.

## 5. Prove fidelity

Read [references/security-and-validation.md](references/security-and-validation.md)
before comparing samples or testing a write.

Compare the direct response with the UI canary or canaries saved during Step 2,
using the reserved holdout when two were available. Perform this comparison
without further UI navigation. Report exact response fields. Treat previews,
summaries, search snippets, and list payloads as incomplete until a detail
response proves otherwise. Preserve source data; format it rather than
reconstructing missing text.

For writes, use one reversible sample, inspect the response, and read it back
through an independent endpoint.

**Complete when:** two controlled samples reproduce the expected result and the
auth/no-auth difference is measured. For writes, the sample is also verified by
read-back.

## 6. Build the durable client

Implement the proven request with:

- secrets from environment variables or a browser session, never source files
- pagination with a tested stopping condition
- timeouts, bounded retries, and rate limiting
- explicit output formats that retain raw IDs and fields
- a low-cost auth check and the failure classifications in the validation reference
- dry-run or confirmation gates for state-changing and bulk operations

Keep capture artifacts out of version control until they are sanitized. Read
[references/security-and-validation.md](references/security-and-validation.md)
before persisting requests, handling write endpoints, or declaring the client
complete.

**Complete when:** the client runs from a fresh process, secrets are absent from
tracked files and logs, pagination terminates correctly, and failures identify
the rediscovery point. State-changing and bulk operations have a dry-run or
confirmation gate.

## 7. Package the site-specific skill

Copy [assets/site-skill-template](assets/site-skill-template) and replace every
placeholder. Include the verified operations, auth acquisition, runnable
examples, evidence date, and a repair path that starts by recapturing traffic.
Keep site facts in that site skill; keep this meta-skill generic.

**Complete when:** every template placeholder is replaced, a fresh agent can run
one read-only operation without UI clicking, and can identify exactly how to
recapture it if the site changes.

## Handoff

Report:

| Evidence | Required content |
|---|---|
| Captured request | action, method, redacted URL, status |
| Replay | command or script path and matching canary |
| Auth | mechanism, programmatic source, measured auth/no-auth difference |
| Surface | endpoints or operations, parameters, pagination |
| Validation | two samples and write read-back when applicable |
| Artifact | client path, site skill path, and secret scan result |
| Limits | anti-bot, rate, account, legal, or browser-bound constraints |

Declare the result **discovered** after capture, **proven** after direct replay
and fidelity checks, and **durable** only after the packaged client passes from a
fresh process.
