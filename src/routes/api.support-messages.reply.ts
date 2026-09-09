import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestUser } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import type { Database } from "@/lib/integrations/my-supabase/types";

type SupportMessage = {
  id: string;
  user_id: string;
  body: string;
  sender: "user" | "support";
  created_at: string;
};

type MessagingDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      support_messages: {
        Row: SupportMessage;
        Insert: Pick<SupportMessage, "user_id" | "body" | "sender">;
        Update: Partial<Pick<SupportMessage, "body" | "sender">>;
        Relationships: [];
      };
    };
  };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function hasMatchingSecret(provided: string, expected: string): Promise<boolean> {
  const [providedDigest, expectedDigest] = await Promise.all(
    [provided, expected].map((value) =>
      globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
  const providedBytes = new Uint8Array(providedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

export const Route = createFileRoute("/api/support-messages/reply")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const configuredSecret = process.env.SUPPORT_REPLY_SECRET;
        const providedSecret = request.headers.get("X-Oakmonte-Internal-Key");
        if (
          !configuredSecret ||
          !providedSecret ||
          !(await hasMatchingSecret(providedSecret, configuredSecret))
        ) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getRequestUser(request);
        if (!user) {
          return Response.json({ error: "Not signed in" }, { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
        }

        const targetUserId =
          typeof payload === "object" && payload !== null && "user_id" in payload
            ? payload.user_id
            : undefined;
        const body =
          typeof payload === "object" && payload !== null && "body" in payload
            ? payload.body
            : undefined;

        if (typeof targetUserId !== "string" || !UUID_PATTERN.test(targetUserId)) {
          return Response.json({ error: "user_id must be a valid UUID" }, { status: 400 });
        }
        if (typeof body !== "string") {
          return Response.json({ error: "body must be a string" }, { status: 400 });
        }

        const trimmedBody = body.trim();
        if (trimmedBody.length < 1 || trimmedBody.length > 4000) {
          return Response.json(
            { error: "body must contain between 1 and 4000 characters" },
            { status: 400 },
          );
        }

        // This authenticates the trusted caller, not the individual staff member.
        // There is no per-staff identity or admin-role system yet; that is an accepted gap.
        const messagingAdmin = supabaseAdmin as unknown as SupabaseClient<MessagingDatabase>;
        const { data, error } = await messagingAdmin
          .from("support_messages")
          .insert({ user_id: targetUserId, body: trimmedBody, sender: "support" })
          .select("id, user_id, body, sender, created_at")
          .single();

        if (error) {
          console.error("support reply: failed to insert message", error);
          return Response.json({ error: "Could not send support reply" }, { status: 500 });
        }

        return Response.json({ message: data }, { status: 201 });
      },
    },
  },
});
