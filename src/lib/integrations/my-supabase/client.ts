import { createClient } from "@supabase/supabase-js";
import { MY_SUPABASE_URL, MY_SUPABASE_PUBLISHABLE_KEY } from "./config";

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

function createMySupabaseClient() {
  return createClient(MY_SUPABASE_URL, MY_SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(MY_SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof createMySupabaseClient> | undefined;

// Import like: import { supabase } from "@/integrations/my-supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createMySupabaseClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createMySupabaseClient();
    return Reflect.get(_client, prop, receiver);
  },
});