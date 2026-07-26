import { createClient } from "@supabase/supabase-js";
import { MY_SUPABASE_URL } from "./config";

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, k) => headers.set(k, value));
    }
    if (isNewKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

function createAdmin() {
  const key = process.env.MY_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing MY_SUPABASE_SERVICE_ROLE_KEY. Add it in project secrets to use the admin client.",
    );
  }
  return createClient(MY_SUPABASE_URL, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof createAdmin> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdmin>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createAdmin();
    return Reflect.get(_admin, prop, receiver);
  },
});