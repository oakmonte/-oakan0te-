// Client half of the staff back-office: calls /api/staff/* with the session.
import { authedFetch } from "@/lib/authed-fetch";

export class StaffApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

/** Sample-data preview on localhost (`/staff?demo=1`, remembered for the tab).
 *  `import.meta.env.DEV` is false in a production build, so this is always
 *  false there and the demo module is never bundled. */
export function isStaffDemo(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("demo")) {
      sessionStorage.setItem("staff-demo", "1");
    }
    return sessionStorage.getItem("staff-demo") === "1";
  } catch {
    return false;
  }
}

/** Calls an /api/staff/* route with the session attached. Throws
 *  StaffApiError with the server's message on any non-2xx. */
export async function staffApi<T>(path: string, init?: { method?: string; body?: unknown }) {
  // DEV checked here, at the import, so a production build removes the whole
  // branch -- and with it the demo chunk.
  if (import.meta.env.DEV && isStaffDemo()) {
    const { demoResponse } = await import("@/lib/staff-demo");
    return demoResponse(path, init) as T;
  }
  const res = await authedFetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new StaffApiError(
      typeof json?.error === "string" ? json.error : `Request failed (${res.status})`,
      res.status,
      json,
    );
  }
  return json as T;
}

export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
