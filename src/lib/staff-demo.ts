// Sample data for previewing /staff on localhost without a staff session:
// open http://localhost:8080/staff?demo=1. Only reachable in `vite dev` --
// staffApi checks import.meta.env.DEV before importing this file, so a
// production build drops it entirely and the real server gate is untouched.
const now = Date.now();
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();

const USERS = {
  adaeze: "11111111-1111-4111-8111-111111111111",
  tunde: "22222222-2222-4222-8222-222222222222",
  kemi: "33333333-3333-4333-8333-333333333333",
  chioma: "44444444-4444-4444-8444-444444444444",
};

const threads = [
  {
    user_id: USERS.adaeze,
    username: "adaeze_styles",
    name: "Adaeze Okafor",
    email: "adaeze@example.com",
    last_body:
      "My order from Lagos Thrift hasn't moved since Friday, the courier says it's not ready",
    last_sender: "user",
    last_at: ago(2),
    awaiting: 2,
  },
  {
    user_id: USERS.tunde,
    username: "tbakare",
    name: "Tunde Bakare",
    email: "tunde@example.com",
    last_body: "Photo",
    last_sender: "user",
    last_at: ago(16),
    awaiting: 1,
  },
  {
    user_id: USERS.kemi,
    username: "kemiwears",
    name: "Kemi Adeyemi",
    email: "kemi@kemiwears.ng",
    last_body: "Done — your payout account is verified now.",
    last_sender: "support",
    last_at: ago(30),
    awaiting: 0,
  },
  {
    user_id: USERS.chioma,
    username: "chioma.n",
    name: "Chioma Nwosu",
    email: "chioma@example.com",
    last_body: "Thank you!",
    last_sender: "support",
    last_at: ago(80),
    awaiting: 0,
  },
];

const messages: Record<string, unknown[]> = {
  [USERS.adaeze]: [
    {
      id: "m1",
      sender: "user",
      body: "Hi, I ordered a denim jacket from Lagos Thrift on Thursday.",
      created_at: ago(50),
      media_url: null,
    },
    {
      id: "m2",
      sender: "support",
      body: "Hi Adaeze, let me check with the seller.",
      created_at: ago(48),
      media_url: null,
    },
    {
      id: "m3",
      sender: "user",
      body: "It still hasn't moved.",
      created_at: ago(3),
      media_url: null,
    },
    {
      id: "m4",
      sender: "user",
      body: "My order from Lagos Thrift hasn't moved since Friday, the courier says it's not ready",
      created_at: ago(2),
      media_url: null,
    },
  ],
};

const kemi = {
  account: {
    id: USERS.kemi,
    email: "kemi@kemiwears.ng",
    phone: null,
    created_at: ago(190),
    last_sign_in_at: ago(12),
    email_confirmed_at: ago(190),
    is_anonymous: false,
    is_staff: false,
    providers: ["email"],
  },
  profile: {
    personal_username: "kemiwears",
    display_name: "Kemi Adeyemi",
    personal_email: "kemi@kemiwears.ng",
    personal_phone: "0803 555 0142",
    account_type: "seller",
    referral_source: "instagram",
    created_at: ago(190),
  },
  stores: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      brand_name: "Kemi Wears",
      store_username: "kemi-wears",
      business_email: "kemi@kemiwears.ng",
      business_phone: "0803 555 0142",
      store_type: "Brand",
      theme_id: "t1",
      onboarded_at: ago(180),
      created_at: ago(190),
      pickup_address_line: "12 Allen Avenue",
      pickup_city: "Ikeja",
      pickup_state: "Lagos",
      pickup_country: "NG",
      shopify_shop_domain: null,
      bumpa_store_id: null,
      products: 14,
      payout: { bank: "GTBank", holder: "Kemi Adeyemi", last4: "4821", status: "verified" },
    },
  ],
  orders_placed: [],
  orders_received: [
    {
      id: "3f9a21c0-0000-4000-8000-000000000001",
      store_id: "s",
      buyer_id: USERS.adaeze,
      guest_email: null,
      status: "shipped",
      total_kobo: 1850000,
      delivery_method: "courier",
      courier_name: "GIG Logistics",
      tracking_url: null,
      created_at: ago(40),
    },
    {
      id: "a17c0e44-0000-4000-8000-000000000002",
      store_id: "s",
      buyer_id: null,
      guest_email: "guest@example.com",
      status: "delivered",
      total_kobo: 4200000,
      delivery_method: "pickup",
      courier_name: null,
      tracking_url: null,
      created_at: ago(90),
    },
  ],
  support_messages: 3,
};

function plainUser(id: string) {
  const t = threads.find((x) => x.user_id === id);
  return {
    ...kemi,
    account: { ...kemi.account, id, email: t?.email ?? null },
    profile: {
      ...kemi.profile,
      personal_username: t?.username ?? "user",
      display_name: t?.name ?? null,
      personal_email: t?.email ?? "",
      account_type: "buyer",
    },
    stores: [],
    orders_placed: kemi.orders_received.slice(0, 1),
    orders_received: [],
  };
}

export function demoResponse(path: string, init?: { method?: string; body?: unknown }): unknown {
  const url = new URL(path, "http://demo");
  const p = url.pathname;
  const method = init?.method ?? "GET";

  if (p === "/api/staff/me") return { email: "demo@oakmonte.store", role: "admin" };
  if (p === "/api/staff/inbox") return { threads };
  if (p.startsWith("/api/staff/support/")) {
    const id = p.split("/").pop() ?? "";
    if (method === "POST") {
      const body = (init?.body as { body?: string })?.body ?? "";
      return {
        message: {
          id: `r${Date.now()}`,
          sender: "support",
          body,
          created_at: new Date().toISOString(),
          media_url: null,
        },
      };
    }
    return {
      messages: messages[id] ?? [
        {
          id: "x",
          sender: "user",
          body: threads.find((t) => t.user_id === id)?.last_body ?? "Hello",
          created_at: ago(20),
          media_url: null,
        },
      ],
    };
  }
  if (p === "/api/staff/users") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    return {
      users: threads
        .filter((t) => !q || `${t.name} ${t.username} ${t.email}`.toLowerCase().includes(q))
        .map((t) => ({
          id: t.user_id,
          username: t.username,
          name: t.name,
          email: t.email,
          created_at: ago(190),
          stores:
            t.user_id === USERS.kemi ? [{ id: "s", name: "Kemi Wears", handle: "kemi-wears" }] : [],
        })),
    };
  }
  if (p.startsWith("/api/staff/users/")) {
    const id = p.split("/").pop() ?? "";
    return id === USERS.kemi ? kemi : plainUser(id);
  }
  if (p === "/api/staff/stores") {
    if (method === "POST") {
      const b = (init?.body ?? {}) as { brand_name?: string; handle?: string };
      const handle = (b.handle || b.brand_name || "new-store")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      return { user_id: USERS.kemi, store_id: "new", handle, created_account: true };
    }
    return {
      themes: [
        { id: "t1", name: "Burgundy", slug: "burgundy", preview_url: "" },
        { id: "t2", name: "Ember", slug: "ember", preview_url: "" },
        { id: "t3", name: "Wine", slug: "wine", preview_url: "" },
        { id: "t4", name: "Snow", slug: "snow", preview_url: "" },
      ],
    };
  }
  if (p === "/api/staff/open-as")
    return { token_hash: "demo-token-not-real", email: "kemi@kemiwears.ng" };
  return {};
}
