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

/** Calls an /api/staff/* route with the session attached. Throws
 *  StaffApiError with the server's message on any non-2xx. */
export async function staffApi<T>(path: string, init?: { method?: string; body?: unknown }) {
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
