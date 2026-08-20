---
name: server-auth
description: How Oakmonte api.* route handlers authenticate callers and verify store ownership — which function to call, why the store is derived from the session rather than validated from the request, the 404-not-403 invariant, the old unused middleware and why not to use it, and the client-side authedFetch pattern. Use when writing or reviewing any api.* route that touches store-scoped data, reading store credentials, or performing any write that needs an authenticated seller.
---

# Server-side auth and store ownership

`api.*` handlers run on the service-role key, which bypasses RLS entirely. That makes the handler
itself the authorization boundary. A `storeId` read off the query string or request body is not an
authorization check — it is an attacker-supplied parameter.

## The two functions. Pick the right one.

Both live in `src/lib/server-auth.ts` and both return a typed result union:

```ts
type StoreAuthResult = { ok: true; value: OwnedStore } | { ok: false; response: Response }
```

The early-return pattern is always:

```ts
const owns = await requireOwnStore(request);   // or requireStoreOwner
if (!owns.ok) return owns.response;
const { storeId, user } = owns.value;
```

### `requireOwnStore(request)` — prefer this

Derives the seller's store from the session. Never reads a storeId from the request at all. Because
there's nothing to tamper with, this is the safer choice for any route where the handler always
operates on "the signed-in seller's store."

Use it for: import routes, credential writes, payout requests — anything where "which store" is
answered by "the one this seller owns."

### `requireStoreOwner(request, storeId)` — use only when storeId must come from the client

Validates that the caller owns the supplied `storeId`. Use only when a seller with more than one
store needs to target a specific one — i.e. the client has a legitimate reason to supply the id.

Even then: the storeId is confirmed against `stores.owner_id = auth.uid()` via `supabaseAdmin`
before any store-scoped work is done. The request's storeId is an input, not a grant.

**404, not 403** on an unknown or unowned storeId. Returning 403 on a real id and 404 on a fake
one would let an attacker enumerate valid store ids by watching the status code. The code returns
404 in both cases, and the comment in `server-auth.ts` explains why.

## `getRequestUser(request)` — when you need the user but not a store

Returns `{ id, email } | null`. Validates the bearer token against Supabase Auth via `supabaseAdmin.auth.getUser`. Returns `null` rather than throwing on any failure — a throwing auth check is one that can be turned off by sending garbage input, which is why the implementation wraps the call in try/catch and returns null on any exception.

Use it when a route needs the caller's identity but doesn't require store ownership (rare).

## Client side: `authedFetch`

The session token lives in localStorage, not a cookie, so it is NOT sent automatically. Handlers
running on the service-role key cannot see who is calling unless the token is attached explicitly.

```ts
import { authedFetch } from "@/lib/authed-fetch";

const res = await authedFetch("/api/import/csv", { method: "POST", body: formData });
```

`authedFetch` reads `supabase.auth.getSession()` and attaches `Authorization: Bearer <token>`. It
also guards against cross-origin credential leaks — it will throw if the URL resolves to a different
origin than the current page.

Never hand-roll `fetch` with a manually-retrieved token on `api.*` routes. Use `authedFetch`.

## The unused middleware — do not use

`src/lib/integrations/my-supabase/auth-middleware.ts` exports `requireMySupabaseAuth`, a TanStack
Start server-function middleware that validates a bearer token via `getClaims`. It is **not used
anywhere in the app** and predates `server-auth.ts`. Do not wire it into new routes — `server-auth`
is the current pattern.

## OAuth callback routes are intentionally unauthenticated

`api.shopify.callback.tsx` and `api.instagram.callback.tsx` receive redirects from the platform,
not from the authenticated browser. The platform sends the callback; there is no session present.
Authorization there is via the signed `state` parameter (HMAC over `storeId` using a server
secret), which proves the server minted the original authorization request. These routes not using
`requireOwnStore` is deliberate, not an oversight.

The known remaining gap on both callback routes: `state` has no per-session nonce, so it does not
prove the browser completing the callback is the one that started it (CSRF on the OAuth flow). That
is documented and deferred, not fixed.

## Secrets

All auth work is server-only. The relevant env vars:

- `MY_SUPABASE_SERVICE_ROLE_KEY` — used by `supabaseAdmin` inside `server-auth.ts`
- `IG_APP_ID`, `IG_APP_SECRET`, `IG_REDIRECT_URI` — Instagram OAuth
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_REDIRECT_URI` — Shopify OAuth

Never `import.meta.env`. Never in a client bundle.
