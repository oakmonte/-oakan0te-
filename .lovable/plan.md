# Fix Google OAuth "redirect fail"

## Likely root cause (unconfirmed until we see the exact failure)
Your external Supabase project (`lzyflkrqexxuyxyudvbw`) doesn't have this app's origins in its **Auth → URL Configuration** allow-list, so after Google authenticates, Supabase refuses to redirect back to `/auth/callback` — the session never lands in the browser.

To confirm, I need one of:
- The exact error text / URL you land on after clicking "Continue with Google", **or**
- A screenshot of the failing page.

## What you need to configure in Supabase (you must do this — I can't touch your external project)

In your Supabase dashboard → **Authentication → URL Configuration**:

1. **Site URL** — set to your primary published origin, e.g.
   `https://oakmonte.store`
2. **Redirect URLs** — add every origin you sign in from, each with `/auth/callback`:
   - `https://oakmonte.store/auth/callback`
   - `https://www.oakmonte.store/auth/callback`
   - `https://oakmontetesting.lovable.app/auth/callback`
   - `https://id-preview--20ab012d-c075-4dc0-92ec-39b0c7e4fbaa.lovable.app/auth/callback`
   - `http://localhost:8080/auth/callback` (optional, for local)

3. In **Authentication → Providers → Google**, confirm the **Authorized redirect URI** shown there (`https://lzyflkrqexxuyxyudvbw.supabase.co/auth/v1/callback`) is added in your **Google Cloud Console → OAuth client → Authorized redirect URIs**.

## Code side (once you confirm the error)
Depending on what you actually see, I'll patch one of:
- `src/routes/auth.callback.tsx` — currently polls `getSession()`. If Supabase returns tokens in the URL hash but the client's `detectSessionInUrl` isn't running, we'll explicitly call `supabase.auth.exchangeCodeForSession(window.location.href)` for the PKCE flow, or parse the hash manually.
- `src/integrations/my-supabase/client.ts` — add `auth: { detectSessionInUrl: true, flowType: "pkce" }` if missing.
- `src/lib/auth.ts` — adjust `redirectTo` if you'd rather land on `/` and let the client auto-detect.

## Next step
Reply with the exact error message or the URL you're stuck on after clicking Google, and I'll implement the matching code fix in one pass.
