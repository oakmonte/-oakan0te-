/**
 * The staff back-office's authorisation boundary. Every /api/staff/* handler
 * calls requireStaff() first and does nothing else until it passes.
 *
 * Staff are rows in public.staff_members (RLS on, no policies, no grants), read
 * here with the service role -- nothing the browser sends decides who is
 * staff. Anonymous sessions are refused outright: they carry the
 * `authenticated` role too, and a stray staff_members row for one must not
 * open the back-office to whoever holds that device.
 *
 * Every failure is the same 404, signed in or not: the back-office should not
 * confirm it exists to someone probing for it.
 *
 * Server-only.
 */
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { untypedTable } from "@/lib/integrations/my-supabase/untyped";
import { bearer } from "@/lib/server-auth";

export type StaffRole = "admin" | "support";
export type StaffUser = { id: string; email: string | null; role: StaffRole };

const PRIVATE_HEADERS = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

/** Every staff response carries other people's data: keep it out of caches. */
export function staffJson(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...PRIVATE_HEADERS, ...init?.headers } });
}

export function staffError(message: string, status: number) {
  return staffJson({ error: message }, { status });
}

const NOT_FOUND = () => staffError("Not found", 404);

export async function requireStaff(
  request: Request,
): Promise<{ ok: true; staff: StaffUser } | { ok: false; response: Response }> {
  const token = bearer(request);
  if (!token) return { ok: false, response: NOT_FOUND() };

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const user = data?.user;
    if (error || !user || user.is_anonymous) return { ok: false, response: NOT_FOUND() };

    const { data: row, error: rowError } = await untypedTable(supabaseAdmin, "staff_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (rowError) {
      // 42P01 / PGRST205: the migration has not been applied yet.
      console.error("requireStaff: staff lookup failed", rowError);
      return { ok: false, response: NOT_FOUND() };
    }
    const role = (row as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "support") return { ok: false, response: NOT_FOUND() };

    return { ok: true, staff: { id: user.id, email: user.email ?? null, role } };
  } catch (err) {
    // A forged token or a missing service-role key lands here. A throwing
    // gate must fail closed, never as an unhandled 500.
    console.error("requireStaff: failed", err);
    return { ok: false, response: NOT_FOUND() };
  }
}

/** Whether a user id belongs to staff -- "open as client" refuses them. */
export async function isStaffUser(userId: string): Promise<boolean> {
  const { data } = await untypedTable(supabaseAdmin, "staff_members")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Appends to the audit trail. A failed write is logged, not thrown: the
 *  action itself already happened, and hiding it behind a 500 would invite a
 *  retry that does it twice. */
export async function logStaffAction(
  staff: StaffUser,
  action: string,
  target: { userId?: string | null; storeId?: string | null; detail?: Record<string, unknown> },
) {
  const { error } = await untypedTable(supabaseAdmin, "staff_actions").insert({
    staff_id: staff.id,
    action,
    target_user_id: target.userId ?? null,
    target_store_id: target.storeId ?? null,
    detail: { by: staff.email, ...target.detail },
  });
  if (error) console.error("logStaffAction: audit write failed", action, error);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
