## Goal

Point the app at your own Supabase project instead of the built-in Lovable Cloud instance.

## Important caveats (please read)

- **Lovable Cloud stays provisioned on this project.** It can't be removed here. The generated files under `src/integrations/supabase/` (`client.ts`, `client.server.ts`, `auth-middleware.ts`, `types.ts`) and the `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` env vars will keep pointing at the Cloud instance. We'll route the app around them.
- **You lose the managed niceties**: auto-generated DB types after migrations, the `supabase--migration` approval flow against your DB, the built-in auth middleware bound to your project, and the Cloud dashboard views for your data.
- **You manage your own**: schema/migrations (via your Supabase dashboard or CLI), auth providers, RLS, storage, and edge functions.

If any of that is a dealbreaker, tell me and we can reconsider.

## What I'll need from you

Three values from your Supabase project (Settings → API):

1. Project URL (e.g. `https://xxxx.supabase.co`)
2. Publishable / anon key (`sb_publishable_...` or legacy `eyJ...` anon key)
3. Service role key (only if you want server-side admin operations)

I'll request these through the secure secret form — don't paste them in chat.

## Plan

1. **Add your keys as project secrets** using the secure form:
   - `MY_SUPABASE_URL`
   - `MY_SUPABASE_PUBLISHABLE_KEY`
   - `MY_SUPABASE_SERVICE_ROLE_KEY` (optional)
   - Plus a matching `VITE_MY_SUPABASE_URL` and `VITE_MY_SUPABASE_PUBLISHABLE_KEY` so the browser bundle can read them (Vite only exposes `VITE_*`).

2. **Create a parallel client module** at `src/integrations/my-supabase/client.ts` that instantiates `@supabase/supabase-js` against your URL + publishable key. This does not touch the generated `src/integrations/supabase/*` files (editing those is disallowed and they'd be regenerated anyway).

3. **Create a server-only admin client** at `src/integrations/my-supabase/client.server.ts` (only if you provide the service-role key), for privileged server-function work.

4. **Codemod all app imports** from `@/integrations/supabase/client` → `@/integrations/my-supabase/client`. Currently there are no such imports in the app yet, so this is a no-op today; the rule will apply going forward.

5. **Swap the auth middleware.** Write a small `src/integrations/my-supabase/auth-middleware.ts` that validates bearer tokens against your project (JWKS discovered from your Supabase URL) and injects a user-scoped client. Server functions that need auth will import from here instead of `@/integrations/supabase/auth-middleware`.

6. **Note on schema changes:** the `supabase--migration` tool only targets the Cloud DB, not yours. I'll give you the SQL to run in your Supabase SQL editor (or your migration tool of choice) whenever schema work is needed.

## Technical details

- Browser client: `createClient(import.meta.env.VITE_MY_SUPABASE_URL, import.meta.env.VITE_MY_SUPABASE_PUBLISHABLE_KEY)` with `persistSession: true`, standard localStorage.
- New-format `sb_publishable_*` / `sb_secret_*` keys need the `fetch`-shim that strips the default `Authorization: Bearer <key>` header PostgREST rejects; I'll include it in both clients.
- Server admin client: `createClient(process.env.MY_SUPABASE_URL, process.env.MY_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })`, loaded inside handlers via `await import(...)` to keep it out of client bundles.
- Auth middleware: fetch `${MY_SUPABASE_URL}/auth/v1/.well-known/jwks.json`, cache in-memory, verify the incoming `Authorization: Bearer` JWT (audience `authenticated`), attach `{ supabase, userId, claims }` to context — mirroring the shape the app currently expects.
- `src/start.ts` `functionMiddleware` will attach the bearer from your client's session (via a small `attachMySupabaseAuth` helper) instead of the generated `attachSupabaseAuth`.

## Deliverables

- New files under `src/integrations/my-supabase/`.
- Updated `src/start.ts`.
- Setup notes for you: which SQL to run in your Supabase, how to configure auth providers, and the redirect URLs to whitelist there.

Ready when you are — approve and I'll request the three secrets first.
