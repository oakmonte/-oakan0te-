---
name: supabase-data-access
description: How Oakmonte talks to its database — which of the two Supabase projects and three clients to use, the server-only boundary for the service-role key, generated types and how to regenerate them, current per-table RLS state, and expand/contract migration discipline. Use when adding or changing any query, insert, or update; writing a route loader or server handler; adding an api.* route; touching auth or sessions; writing a migration; enabling RLS or writing policies; or debugging a query that returns nothing, returns everything, or 500s in SSR.
---

# Supabase data access

Getting this wrong has two failure modes that neither the typechecker nor the browser will show you:
a service-role key shipped in the client bundle, and a query that silently reads across tenants.
Both look completely normal in a dev session. That's why this is written down.

## There are two Supabase projects. Only one is real.

| Path                                 | What it is                                              | Use it?                        |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------ |
| `src/integrations/supabase/*`        | Lovable Cloud's auto-managed integration                | **No.** Generated, don't edit. |
| `src/lib/integrations/supabase/*`    | byte-identical duplicate of the above                   | **No.**                        |
| `src/lib/integrations/my-supabase/*` | the app's own external project (`lzyflkrqexxuyxyudvbw`) | **Yes — this is the one.**     |

Everything real imports from `my-supabase`: auth, sessions, every `store.*` route, all four `api.*`
routes. If you find yourself importing `@/integrations/supabase/...`, you're in the wrong project and
your query will hit a database with none of the app's data in it.

## Which client

**`@/lib/integrations/my-supabase/client`** → `supabase`. Browser client, publishable key. Safe in
bundles. Subject to RLS _where RLS is enabled_ — read the RLS section before assuming that's a
protection.

**`@/lib/integrations/my-supabase/client.server`** → `supabaseAdmin`. Service-role key from
`process.env.MY_SUPABASE_SERVICE_ROLE_KEY`. **Bypasses RLS entirely.** Every row of every table, no
policy checks. Only in code you're certain never reaches the client bundle.

Both are lazy `Proxy` wrappers — the underlying client is constructed on first property access, not at
import time. That's what lets `client.server.ts` be imported without exploding when the env var is
missing; it throws when you actually touch it.

### The import rule that actually bites

Route files (`src/routes/*.tsx`) and `*.functions.ts` can ship to the client bundle. Measured on the
current build (2026-08-19): Nitro does strip `server.handlers` out, and neither `supabaseAdmin` nor
`MY_SUPABASE_SERVICE_ROLE_KEY` appears anywhere in `.output/public` — including from
`api.shopify.callback.tsx`, which imports the admin client at the top level.

So this is defense in depth, not a live leak. It still matters, because the stripping depends on the
bundler proving the module is unreachable from a client entry point — and that proof breaks the moment
a route file grows a component alongside its handler, or a shared module starts re-exporting it. The
failure is silent when it happens.

So: pull it in with a dynamic `import()` _inside_ the handler.

```ts
// in an api.*.ts handler or a server function
const { supabaseAdmin } = await import("@/lib/integrations/my-supabase/client.server");
```

The exception is when you're already inside another `.server.ts` module — that file is server-only by
the TanStack Start convention, so a normal top-level import is fine there.

`.server.ts` is the convention because the npm `server-only` package is ESLint-blocked in this repo.
The suffix is load-bearing, not decorative.

## Types

The client is typed: `createClient<Database>(...)` in both `client.ts` and `client.server.ts`, with
`Database` from `@/lib/integrations/my-supabase/types`. That means table names, column names, and
insert shapes are checked by `bun run typecheck`.

Regenerate after any schema change — the types are a snapshot, and a stale snapshot is worse than none
because it type-checks against a schema that no longer exists:

```
mcp__supabase__generate_typescript_types   → write to src/lib/integrations/my-supabase/types.ts
```

The three generated `types.ts` files are eslint-ignored (see `eslint.config.js`) since they're replaced
wholesale and formatting them never survives.

Useful helpers exported from that file — prefer them over hand-writing row shapes, which drift:

```ts
import type { Tables, TablesInsert } from "@/lib/integrations/my-supabase/types";

type Product = Tables<"products">;
type NewVariant = TablesInsert<"product_variants">;
```

**Views are not tables.** `profile_stats` (follower/following/sold/rating counts) is a view keyed by
profile id. Asking `profiles` for those columns makes PostgREST reject the entire select — the query
returns an error, not a partial row, so the UI just renders empty. Query the view separately by `id`.

## RLS state (as of 2026-08-18) — verify before trusting

RLS is **disabled** on `stores`, `products`, and `product_variants`. It is enabled on everything else.

Those three are the tables the seller dashboard writes to directly from the browser. With RLS off, the
publishable key can read and modify every row in them — every store's products, not just the signed-in
seller's. This is a known pre-launch hole, documented in
`supabase/migrations/20260818151219_normalize_variant_options.sql`, and it is coupled to the hardcoded
`DEV_STORE_ID` in `store.products_.new.tsx` / `store.products.tsx`.

Check current state rather than trusting this paragraph:

```
mcp__supabase__get_advisors   → security advisors, including rls_disabled
```

**Enabling RLS on those tables without writing policies in the same change will break every write in
the seller dashboard instantly.** The order that works is: replace `DEV_STORE_ID` with real
session-derived store scoping → write policies against `stores.owner_id = auth.uid()` and
`products.store_id in (...)` → then enable. Don't do step three first because it's the one-liner.

## Migrations

Migrations live in `supabase/migrations/`. Follow expand/contract, which the variant-options migration
already models:

1. **Expand** — add the new shape, backfill, keep the old columns populated. Nothing drops.
2. Switch the app over, verify against real data.
3. **Contract** — a second migration removes the old shape.

Both representations stay written during the window between 1 and 3. For product options specifically,
that window is open right now — see the `canonical-product-schema` skill for exactly what dual-writing
means there.

When a migration touches a table whose RLS state differs from its neighbours, say so in a comment in
the migration itself. The next person to read it needs to know whether the omission was deliberate.

If a data error vanishes into a blank 500 instead of the message you threw, that's SSR error handling
swallowing it — see the three-layer explanation in root `CLAUDE.md`, not a bug in the query itself.

## Secrets

Server-only, `process.env` only, never `import.meta.env`:
`MY_SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`,
`SHOPIFY_REDIRECT_URI`, `SHIPBUBBLE_API_KEY`.

The URL and publishable key in `my-supabase/config.ts` are checked into the repo on purpose — those are
meant to be public. The service-role key is not, and must never acquire a `VITE_` prefix, which would
inline it into the bundle.
