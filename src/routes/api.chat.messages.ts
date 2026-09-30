import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/lib/integrations/my-supabase/types";
import type { MessageKind } from "@/lib/chat/db";
import {
  chatError,
  editMessage,
  failure,
  fetchByIds,
  fetchPage,
  insertMessage,
  privateJson,
  requireCaller,
  validateBody,
} from "@/lib/chat/chat.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: MessageKind[] = ["text", "image", "audio"];
const MAX_IDS = 100;

function isTimestamp(value: string | null): value is string {
  return !!value && !Number.isNaN(Date.parse(value));
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Message bodies in and out. Encrypted at rest, so this is the only way the
 * app reads or writes them — see chat.server.ts. Everything else about a
 * message (reactions, hides, deleting for everyone, media) still goes straight
 * from the browser to Supabase, because none of it carries text.
 *
 * GET   ?conversationId=&before=&clearedAt=   one page, oldest-first
 * GET   ?ids=a,b,c                            specific messages (quotes, realtime)
 * POST  { id, conversationId, kind, body?, mediaPath?, meta?, replyToId?, forwarded? }
 * PATCH { id, body }                          edit
 */
export const Route = createFileRoute("/api/chat/messages")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const caller = await requireCaller(request);
        if (!caller.ok) return caller.response;
        const url = new URL(request.url);

        const idList = url.searchParams.get("ids");
        if (idList !== null) {
          const ids = [...new Set(idList.split(",").filter(Boolean))];
          if (ids.length > MAX_IDS || !ids.every((id) => UUID.test(id))) {
            return chatError("Invalid ids", 400);
          }
          try {
            return privateJson({ messages: await fetchByIds(caller.value.db, ids) });
          } catch (err) {
            return failure(err, "Could not load messages");
          }
        }

        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId || !UUID.test(conversationId)) {
          return chatError("conversationId required", 400);
        }
        const before = url.searchParams.get("before");
        const clearedAt = url.searchParams.get("clearedAt");
        if ((before && !isTimestamp(before)) || (clearedAt && !isTimestamp(clearedAt))) {
          return chatError("Invalid timestamp", 400);
        }
        try {
          return privateJson(await fetchPage(caller.value, conversationId, { before, clearedAt }));
        } catch (err) {
          return failure(err, "Could not load messages");
        }
      },

      POST: async ({ request }: { request: Request }) => {
        const caller = await requireCaller(request);
        if (!caller.ok) return caller.response;
        const input = await readJson(request);
        if (!input) return chatError("Request body must be JSON", 400);

        const { id, conversationId, kind, mediaPath, replyToId } = input;
        if (typeof id !== "string" || !UUID.test(id)) return chatError("Invalid id", 400);
        if (typeof conversationId !== "string" || !UUID.test(conversationId)) {
          return chatError("Invalid conversationId", 400);
        }
        if (!KINDS.includes(kind as MessageKind)) return chatError("Invalid kind", 400);
        if (replyToId != null && (typeof replyToId !== "string" || !UUID.test(replyToId))) {
          return chatError("Invalid replyToId", 400);
        }
        if (mediaPath != null && typeof mediaPath !== "string") {
          return chatError("Invalid mediaPath", 400);
        }
        const check = validateBody(input.body, kind === "text");
        if (!check.ok) return chatError(check.error, 400);
        const body = check.body;

        try {
          const message = await insertMessage(caller.value, {
            id,
            conversationId,
            kind: kind as MessageKind,
            body,
            mediaPath: mediaPath ?? null,
            meta: (input.meta ?? null) as Json,
            replyToId: replyToId ?? null,
            forwarded: input.forwarded === true,
          });
          return privateJson({ message }, { status: 201 });
        } catch (err) {
          return failure(err, "Message not sent");
        }
      },

      PATCH: async ({ request }: { request: Request }) => {
        const caller = await requireCaller(request);
        if (!caller.ok) return caller.response;
        const input = await readJson(request);
        if (!input) return chatError("Request body must be JSON", 400);
        if (typeof input.id !== "string" || !UUID.test(input.id)) {
          return chatError("Invalid id", 400);
        }
        const check = validateBody(input.body, true);
        if (!check.ok || !check.body)
          return chatError(check.ok ? "Message is empty" : check.error, 400);
        const body = check.body;
        try {
          await editMessage(caller.value.db, input.id, body);
          return privateJson({ ok: true });
        } catch (err) {
          return failure(err, "Could not edit the message");
        }
      },
    },
  },
});
