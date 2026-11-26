import { createFileRoute } from "@tanstack/react-router";
import { demoResponse } from "@/lib/staff-demo";

// The staff dashboard's sample-data preview, served behind a shared password so
// it can be shown on a deployed URL before staff logins are set up.
//
//   POST /api/staff-demo/unlock {password}  -> sets an HttpOnly cookie
//   GET|POST /api/staff-demo/<staff path>   -> sample data for /api/staff/<path>
//
// SAMPLE DATA ONLY. This never touches the database and has no path into the
// real /api/staff/* handlers, which keep their own staff_members check.
//
// Off unless STAFF_DEMO_PASSWORD or STAFF_DEMO_LOGINS is set (see handle()).
const COOKIE = "oak_staff_demo";
const MAX_AGE = 60 * 60 * 24 * 7;

const NO_STORE = { "Cache-Control": "no-store, private" } as const;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

async function digest(value: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`oakmonte-staff-demo:${value}`),
  );
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare of two equal-length hex digests. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseLogins(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [name, code] = pair.split(":").map((x) => x?.trim() ?? "");
    if (name && code) map.set(name.toLowerCase(), code);
  }
  return map;
}

function cookieValue(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

async function handle(request: Request, splat: string) {
  // Two ways in, either may be set: one shared password (STAFF_DEMO_PASSWORD),
  // and per-person links /<name>/<code>/admin (STAFF_DEMO_LOGINS, written
  // "diadem:1212,ejiro:1111"). The cookie proves knowledge of the current
  // config, so changing either variable signs everyone out.
  const password = process.env.STAFF_DEMO_PASSWORD ?? "";
  const logins = parseLogins(process.env.STAFF_DEMO_LOGINS ?? "");
  if (!password && logins.size === 0) return json({ error: "Not found" }, 404);
  const expected = await digest(`${password}|${process.env.STAFF_DEMO_LOGINS ?? ""}`);

  if (splat === "unlock") {
    if (request.method !== "POST") return json({ error: "Not found" }, 404);
    let body: { password?: unknown; who?: unknown; code?: unknown } = {};
    try {
      body = ((await request.json()) as typeof body) ?? {};
    } catch {
      body = {};
    }
    const given = typeof body.password === "string" ? body.password : "";
    const who = typeof body.who === "string" ? body.who.toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code : "";

    let ok = false;
    if (password && given) ok = same(await digest(given), await digest(password));
    if (!ok && who && code && logins.has(who)) {
      ok = same(await digest(code), await digest(logins.get(who) as string));
    }
    if (!ok) return json({ error: "Wrong password" }, 401);
    return json({ ok: true }, 200, {
      "Set-Cookie": `${COOKIE}=${expected}; Path=/api/staff-demo; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`,
    });
  }

  const cookie = cookieValue(request);
  if (!cookie || !same(cookie, expected)) return json({ error: "Password required" }, 401);

  let body: unknown;
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
  }
  const search = new URL(request.url).search;
  return json(demoResponse(`/api/staff/${splat}${search}`, { method: request.method, body }));
}

type Ctx = { request: Request; params: { _splat?: string } };

export const Route = createFileRoute("/api/staff-demo/$")({
  server: {
    handlers: {
      GET: ({ request, params }: Ctx) => handle(request, params._splat ?? ""),
      POST: ({ request, params }: Ctx) => handle(request, params._splat ?? ""),
    },
  },
});
