import { describe, expect, test } from "bun:test";
import { bucket } from "./media";
import {
  canEdit,
  describeMessage,
  isJumboEmoji,
  linkify,
  presenceLabel,
  sortChats,
  summariseReactions,
  tickFor,
  type Chat,
  type ChatMessage,
} from "./model";

const NOW = new Date("2026-09-27T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function chat(overrides: Partial<Chat>): Chat {
  return {
    id: "c",
    kind: "direct",
    title: "Ada",
    handle: "ada",
    peer: null,
    verified: false,
    lastMessageAt: ago(0),
    lastMessage: null,
    unreadCount: 0,
    markedUnread: false,
    pinnedAt: null,
    muted: false,
    archivedAt: null,
    lastReadAt: null,
    clearedAt: null,
    peerLastReadAt: null,
    peerLastDeliveredAt: null,
    peerLastActiveAt: null,
    blockedByMe: false,
    ...overrides,
  };
}

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m",
    conversationId: "c",
    senderId: "me",
    kind: "text",
    body: "hi",
    mediaPath: null,
    meta: {},
    replyToId: null,
    forwarded: false,
    editedAt: null,
    deletedAt: null,
    createdAt: ago(60_000),
    ...overrides,
  };
}

describe("tickFor", () => {
  const sentAt = ago(60_000);

  test("a local send reports its own state", () => {
    expect(tickFor({ createdAt: sentAt, status: "sending" }, chat({}))).toBe("sending");
    expect(tickFor({ createdAt: sentAt, status: "failed" }, chat({}))).toBe("failed");
  });

  test("the peer's watermarks decide sent, delivered and read", () => {
    expect(tickFor({ createdAt: sentAt }, chat({}))).toBe("sent");
    expect(tickFor({ createdAt: sentAt }, chat({ peerLastDeliveredAt: ago(1000) }))).toBe(
      "delivered",
    );
    expect(
      tickFor({ createdAt: sentAt }, chat({ peerLastDeliveredAt: ago(0), peerLastReadAt: ago(0) })),
    ).toBe("read");
    // Read before this message was sent does not count.
    expect(tickFor({ createdAt: sentAt }, chat({ peerLastReadAt: ago(120_000) }))).toBe("sent");
  });

  test("notes to yourself are always read", () => {
    expect(tickFor({ createdAt: sentAt }, chat({ kind: "self" }))).toBe("read");
  });
});

describe("presenceLabel", () => {
  test("recent activity is online, then decays to last seen", () => {
    expect(presenceLabel(null, NOW)).toBeNull();
    expect(presenceLabel(ago(30_000), NOW)).toBe("online");
    expect(presenceLabel(ago(12 * 60_000), NOW)).toBe("last seen 12m ago");
    expect(presenceLabel(ago(3 * 3_600_000), NOW)).toBe("last seen 3h ago");
    expect(presenceLabel(ago(30 * 3_600_000), NOW)).toBe("last seen yesterday");
    expect(presenceLabel(ago(30 * 86_400_000), NOW)).toBe("last seen a while ago");
  });
});

describe("sortChats", () => {
  test("pinned first, newest pin on top, then by latest message", () => {
    const sorted = sortChats([
      chat({ id: "old", lastMessageAt: ago(10_000) }),
      chat({ id: "new", lastMessageAt: ago(1_000) }),
      chat({ id: "pin-a", pinnedAt: ago(5_000), lastMessageAt: ago(99_000) }),
      chat({ id: "pin-b", pinnedAt: ago(1_000), lastMessageAt: ago(99_000) }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["pin-b", "pin-a", "new", "old"]);
  });
});

describe("describeMessage", () => {
  test("says what an attachment is", () => {
    expect(describeMessage({ kind: "image", body: null, meta: {} })).toBe("Photo");
    expect(describeMessage({ kind: "image", body: "fit check", meta: {} })).toBe(
      "Photo · fit check",
    );
    expect(describeMessage({ kind: "audio", body: null, meta: { duration: 65 } })).toBe(
      "Voice message · 1:05",
    );
    expect(describeMessage({ kind: "text", body: "x", meta: {}, deleted: true })).toBe(
      "This message was deleted",
    );
  });
});

describe("summariseReactions", () => {
  test("groups by emoji, most used first, and marks mine", () => {
    const rows = [
      { message_id: "m", user_id: "a", conversation_id: "c", emoji: "❤️", created_at: "" },
      { message_id: "m", user_id: "me", conversation_id: "c", emoji: "😂", created_at: "" },
      { message_id: "m", user_id: "b", conversation_id: "c", emoji: "😂", created_at: "" },
    ];
    expect(summariseReactions(rows, "me")).toEqual([
      { emoji: "😂", count: 2, mine: true },
      { emoji: "❤️", count: 1, mine: false },
    ]);
  });
});

describe("canEdit", () => {
  test("only my own sent text, inside the 15 minute window", () => {
    expect(canEdit(message({}), "me", NOW)).toBe(true);
    expect(canEdit(message({ senderId: "them" }), "me", NOW)).toBe(false);
    expect(canEdit(message({ kind: "image" }), "me", NOW)).toBe(false);
    expect(canEdit(message({ status: "sending" }), "me", NOW)).toBe(false);
    expect(canEdit(message({ deletedAt: ago(0) }), "me", NOW)).toBe(false);
    expect(canEdit(message({ createdAt: ago(16 * 60_000) }), "me", NOW)).toBe(false);
  });
});

describe("isJumboEmoji", () => {
  test("one to three emoji and nothing else", () => {
    expect(isJumboEmoji("😂")).toBe(true);
    expect(isJumboEmoji("❤️‍🔥")).toBe(true);
    expect(isJumboEmoji("👍🏽👍🏽")).toBe(true);
    expect(isJumboEmoji("🇳🇬")).toBe(true);
    expect(isJumboEmoji("😂😂😂😂")).toBe(false);
    expect(isJumboEmoji("ok 👍")).toBe(false);
    expect(isJumboEmoji("123")).toBe(false);
    expect(isJumboEmoji("#")).toBe(false);
    expect(isJumboEmoji("")).toBe(false);
  });
});

describe("linkify", () => {
  test("splits links out without swallowing trailing punctuation", () => {
    expect(linkify("see https://oakmonte.store/p/1, thanks")).toEqual([
      { text: "see " },
      { text: "https://oakmonte.store/p/1", href: "https://oakmonte.store/p/1" },
      { text: ", thanks" },
    ]);
    expect(linkify("no links")).toEqual([{ text: "no links" }]);
  });
});

describe("waveform bucket", () => {
  test("reduces samples to the bar count with a visible floor", () => {
    const bars = bucket([0, 0.5, 1, 0.2, 0, 0, 0.9, 0.1], 4);
    expect(bars).toEqual([0.5, 1, 0.08, 0.9]);
    expect(bucket([], 3)).toEqual([0.15, 0.15, 0.15]);
  });
});
