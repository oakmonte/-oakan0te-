import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";

// Every `api.*` handler that touches store-scoped data runs with the
// service-role key, which bypasses RLS entirely. That makes the handler itself
// the ONLY authorization boundary — a `storeId` read straight off the query
// string is not an authorization check, it is an attacker-supplied parameter.
//
// The browser client keeps its session in localStorage, so the access token is
// not sent automatically like a cookie. Callers must attach it explicitly:
//
//   const { data } = await supabase.auth.getSession();
//   fetch(url, { headers: authHeader(data.session) })

export type ServerUser = { id: string; email: string | null };

function bearer(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Validates the caller's access token against Supabase Auth. Returns null when
 *  there is no valid session — never trust a user id sent in the request body. */
export async function getRequestUser(request: Request): Promise<ServerUser | null> {
  const token = bearer(request);
  if (!token) return null;

  // A malformed or forged JWT makes auth-js throw rather than return an error,
  // and building the admin client throws outright when the service-role key is
  // missing. Both must land as "not authenticated", not as an unhandled 500 —
  // a throwing authorization check is an authorization check that can be
  // turned off by sending garbage.
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch (err) {
    console.error("getRequestUser: token validation failed", err);
    return null;
  }
}

export type OwnedStore = { storeId: string; user: ServerUser };

export type StoreAuthResult = { ok: true; value: OwnedStore } | { ok: false; response: Response };

/** Resolves the store the CALLER owns, ignoring any store id in the request.
 *
 *  Deriving the store from the session rather than validating a supplied one
 *  means there is no id to tamper with in the first place. `stores` has no
 *  unique constraint on owner_id, so this deliberately picks the oldest row —
 *  the same one the dashboard treats as the seller's store. */
export async function requireOwnStore(request: Request): Promise<StoreAuthResult> {
  const user = await getRequestUser(request);
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Not signed in" }, { status: 401 }),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    // created_at alone is not a total order — two rows sharing a timestamp
    // could come back in either order, so a GET could read one store while a
    // POST wrote the other. id breaks the tie deterministically.
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  if (error) {
    console.error("requireOwnStore: store lookup failed", error);
    return {
      ok: false,
      response: Response.json({ error: "Could not verify store ownership" }, { status: 500 }),
    };
  }

  const storeId = data?.[0]?.id;
  if (!storeId) {
    return {
      ok: false,
      response: Response.json({ error: "No store on this account" }, { status: 403 }),
    };
  }

  return { ok: true, value: { storeId, user } };
}

/** Verifies the caller owns `storeId`. Use only where the id genuinely has to
 *  come from the client (a seller with several stores); prefer requireOwnStore. */
export async function requireStoreOwner(
  request: Request,
  storeId: string | null,
): Promise<StoreAuthResult> {
  const user = await getRequestUser(request);
  if (!user) {
    return { ok: false, response: Response.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (!storeId) {
    return { ok: false, response: Response.json({ error: "storeId required" }, { status: 400 }) };
  }

  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("requireStoreOwner: store lookup failed", error);
    return {
      ok: false,
      response: Response.json({ error: "Could not verify store ownership" }, { status: 500 }),
    };
  }

  // 404, not 403: a "forbidden" on a real id and a "not found" on a fake one
  // would let someone enumerate which store ids exist.
  if (!data) {
    return { ok: false, response: Response.json({ error: "Store not found" }, { status: 404 }) };
  }

  return { ok: true, value: { storeId: data.id, user } };
}
