import { createFileRoute } from "@tanstack/react-router";
import { requireStaff, staffJson } from "@/lib/staff.server";

// Whether the caller is staff, for the /staff layout to decide what to render.
// The layout's answer is cosmetic; every other /api/staff/* handler runs the
// same check itself before touching anything.
export const Route = createFileRoute("/api/staff/me")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;
        return staffJson({ email: auth.staff.email, role: auth.staff.role });
      },
    },
  },
});
