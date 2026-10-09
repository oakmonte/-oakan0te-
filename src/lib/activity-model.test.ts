import { describe, expect, test } from "bun:test";
import {
  buildBuyerOrderItems,
  buildFollowItems,
  buildMessageItems,
  buildSellerOrderItems,
  countUnseen,
  filterActivity,
  groupActivity,
  isUnseen,
  lastSeenStorageKey,
  mergeActivity,
  parseLastSeen,
  personFrom,
  seenWatermark,
  sourcesForFilter,
  summariseLines,
  type ActivityItem,
  type InboxActivityRow,
} from "./activity-model";

const NOW = new Date("2026-10-08T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function follow(id: string, at: string): ActivityItem {
  return {
    kind: "follow",
    key: `follow:${id}`,
    at,
    person: { id, username: id, name: id, avatarUrl: null },
    followingBack: false,
  };
}

function inbox(overrides: Partial<InboxActivityRow>): InboxActivityRow {
  return {
    conversation_id: "c1",
    kind: "direct",
    muted: false,
    archived_at: null,
    blocked_by_me: false,
    unread_count: 2,
    last_message_at: ago(5 * MIN),
    last_message_created_at: ago(5 * MIN),
    other_user_id: "ada",
    other_username: "ada",
    other_display_name: "Ada",
    other_avatar_url: null,
    ...overrides,
  };
}

describe("personFrom", () => {
  test("prefers the display name, then the handle", () => {
    expect(
      personFrom({ id: "u", personal_username: "ada", display_name: " Ada O ", avatar_url: null })
        ?.name,
    ).toBe("Ada O");
    expect(
      personFrom({ id: "u", personal_username: "ada", display_name: "", avatar_url: null })?.name,
    ).toBe("@ada");
  });

  test("an account with no username still has a name but no profile link", () => {
    const person = personFrom({
      id: "u",
      personal_username: null,
      display_name: null,
      avatar_url: "",
    });
    expect(person).toEqual({ id: "u", username: null, name: "Oakmonte member", avatarUrl: null });
  });

  test("a row without an id is no one", () => {
    expect(
      personFrom({ id: null, personal_username: "x", display_name: "X", avatar_url: null }),
    ).toBeNull();
  });
});

describe("buildFollowItems", () => {
  const profiles = [
    { id: "ada", personal_username: "ada", display_name: "Ada", avatar_url: null },
    { id: "bo", personal_username: "bo", display_name: "Bo", avatar_url: "https://x/bo.jpg" },
    { id: "cy", personal_username: "cy", display_name: "Cy", avatar_url: null },
  ];

  test("marks the people the viewer already follows back", () => {
    const items = buildFollowItems({
      me: "me",
      follows: [
        { follower_id: "ada", created_at: ago(HOUR) },
        { follower_id: "bo", created_at: ago(2 * HOUR) },
      ],
      profiles,
      iFollow: ["bo"],
      blocked: [],
    });
    expect(items.map((item) => item.kind === "follow" && item.followingBack)).toEqual([
      false,
      true,
    ]);
    expect(items[1].kind === "follow" && items[1].person.avatarUrl).toBe("https://x/bo.jpg");
  });

  test("leaves out blocked people, the viewer themself and anyone without a profile", () => {
    const items = buildFollowItems({
      me: "me",
      follows: [
        { follower_id: "ada", created_at: ago(HOUR) },
        { follower_id: "cy", created_at: ago(HOUR) },
        { follower_id: "me", created_at: ago(HOUR) },
        { follower_id: "ghost", created_at: ago(HOUR) },
      ],
      profiles,
      iFollow: [],
      blocked: ["cy"],
    });
    expect(items.map((item) => item.key)).toEqual(["follow:ada"]);
  });
});

describe("summariseLines", () => {
  test("picks the same line every time, preferring one with a photo", () => {
    const lines = [
      { order_id: "o1", title: "Zip jacket", image_url: "https://x/z.jpg" },
      { order_id: "o1", title: "Belt", image_url: null },
      { order_id: "o2", title: "Scarf", image_url: null },
    ];
    const summary = summariseLines(lines);
    expect(summary.get("o1")).toEqual({
      title: "Zip jacket",
      lineCount: 2,
      imageUrl: "https://x/z.jpg",
    });
    // Reversed input, same answer.
    expect(summariseLines([...lines].reverse()).get("o1")?.title).toBe("Zip jacket");
    expect(summary.get("o2")).toEqual({ title: "Scarf", lineCount: 1, imageUrl: null });
  });

  test("with no photos, the first title alphabetically leads", () => {
    const summary = summariseLines([
      { order_id: "o1", title: "Shirt", image_url: null },
      { order_id: "o1", title: "Belt", image_url: null },
    ]);
    expect(summary.get("o1")?.title).toBe("Belt");
  });
});

describe("buildBuyerOrderItems", () => {
  test("one item per order at its current status, with the store's name", () => {
    const items = buildBuyerOrderItems({
      orders: [
        {
          id: "o1",
          status: "shipped",
          store_id: "s1",
          total_kobo: 2_500_000,
          updated_at: ago(HOUR),
        },
        {
          id: "o2",
          status: "awaiting_payment",
          store_id: "s1",
          total_kobo: 100,
          updated_at: ago(0),
        },
      ],
      lines: [{ order_id: "o1", title: "Linen shirt", image_url: null }],
      storeNames: new Map([["s1", "Wine & Ember"]]),
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "my-order",
      key: "order:o1:shipped",
      status: "shipped",
      storeName: "Wine & Ember",
      totalKobo: 2_500_000,
      title: "Linen shirt",
      lineCount: 1,
    });
  });

  test("a new status is a new item, so it reads as new again", () => {
    const shipped = buildBuyerOrderItems({
      orders: [{ id: "o1", status: "shipped", store_id: "s", total_kobo: 1, updated_at: ago(DAY) }],
      lines: [],
      storeNames: new Map(),
    });
    const delivered = buildBuyerOrderItems({
      orders: [{ id: "o1", status: "delivered", store_id: "s", total_kobo: 1, updated_at: ago(0) }],
      lines: [],
      storeNames: new Map(),
    });
    expect(shipped[0].key).not.toBe(delivered[0].key);
    expect(delivered[0]).toMatchObject({ storeName: null, title: "Your order", lineCount: 0 });
  });
});

describe("buildSellerOrderItems", () => {
  const lines = [{ order_id: "o1", title: "Dress", image_url: null }];

  test("a delivered order is both the new order (at payment) and the delivery", () => {
    const items = buildSellerOrderItems({
      orders: [
        {
          id: "o1",
          status: "delivered",
          total_kobo: 900_000,
          ship_to: { name: " Ada " },
          updated_at: ago(HOUR),
        },
      ],
      payments: [{ order_id: "o1", confirmed_at: ago(3 * DAY) }],
      lines,
    });
    expect(items.map((item) => [item.key, item.at])).toEqual([
      ["store-order:o1:paid", ago(3 * DAY)],
      ["store-order:o1:delivered", ago(HOUR)],
    ]);
    expect(items[0]).toMatchObject({
      buyerName: "Ada",
      totalKobo: 900_000,
      title: "Dress",
      toShip: false,
    });
  });

  test("the new-order item survives the order moving on to shipped", () => {
    const items = buildSellerOrderItems({
      orders: [{ id: "o1", status: "shipped", total_kobo: 1, ship_to: null, updated_at: ago(0) }],
      payments: [{ order_id: "o1", confirmed_at: ago(DAY) }],
      lines,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ event: "paid", at: ago(DAY), buyerName: null, toShip: false });
  });

  test("still-paid with no confirmation row falls back to updated_at", () => {
    const items = buildSellerOrderItems({
      orders: [{ id: "o1", status: "paid", total_kobo: 1, ship_to: {}, updated_at: ago(MIN) }],
      payments: [],
      lines,
    });
    expect(items[0]).toMatchObject({ event: "paid", at: ago(MIN), toShip: true });
  });

  test("the earliest confirmation dates the order", () => {
    const items = buildSellerOrderItems({
      orders: [{ id: "o1", status: "paid", total_kobo: 1, ship_to: null, updated_at: ago(0) }],
      payments: [
        { order_id: "o1", confirmed_at: ago(HOUR) },
        { order_id: "o1", confirmed_at: ago(2 * HOUR) },
        { order_id: "o1", confirmed_at: null },
      ],
      lines,
    });
    expect(items[0].at).toBe(ago(2 * HOUR));
  });

  test("unpaid and declined orders aren't the seller's news", () => {
    const items = buildSellerOrderItems({
      orders: [
        { id: "a", status: "awaiting_payment", total_kobo: 1, ship_to: null, updated_at: ago(0) },
        { id: "b", status: "declined", total_kobo: 1, ship_to: null, updated_at: ago(0) },
      ],
      payments: [],
      lines: [],
    });
    expect(items).toEqual([]);
  });
});

describe("buildMessageItems", () => {
  test("an unread direct chat becomes one item, dated by its last message", () => {
    const items = buildMessageItems([inbox({})]);
    expect(items).toEqual([
      {
        kind: "messages",
        key: "chat:c1",
        at: ago(5 * MIN),
        conversationId: "c1",
        person: { id: "ada", username: "ada", name: "Ada", avatarUrl: null },
        unreadCount: 2,
      },
    ]);
  });

  test("read, muted, archived, blocked and note-to-self chats stay quiet", () => {
    const items = buildMessageItems([
      inbox({ conversation_id: "read", unread_count: 0 }),
      inbox({ conversation_id: "muted", muted: true }),
      inbox({ conversation_id: "archived", archived_at: ago(DAY) }),
      inbox({ conversation_id: "blocked", blocked_by_me: true }),
      inbox({ conversation_id: "self", kind: "self", other_user_id: null }),
    ]);
    expect(items).toEqual([]);
  });

  test("falls back to last_message_at when the message time is missing", () => {
    const items = buildMessageItems([
      inbox({ last_message_created_at: null, last_message_at: ago(HOUR) }),
    ]);
    expect(items[0].at).toBe(ago(HOUR));
  });
});

describe("mergeActivity", () => {
  test("newest first across sources, de-duplicated, capped", () => {
    const merged = mergeActivity(
      [
        [follow("a", ago(3 * HOUR)), follow("b", ago(HOUR))],
        [follow("c", ago(2 * HOUR)), follow("a", ago(0))],
      ],
      2,
    );
    expect(merged.map((item) => item.key)).toEqual(["follow:b", "follow:c"]);
  });

  test("same timestamp keeps a stable order", () => {
    const at = ago(HOUR);
    const one = mergeActivity([[follow("b", at), follow("a", at)]]);
    const two = mergeActivity([[follow("a", at), follow("b", at)]]);
    expect(one.map((item) => item.key)).toEqual(two.map((item) => item.key));
  });
});

describe("filterActivity", () => {
  const items: ActivityItem[] = [
    follow("a", ago(0)),
    ...buildMessageItems([inbox({})]),
    ...buildBuyerOrderItems({
      orders: [{ id: "o", status: "paid", store_id: "s", total_kobo: 1, updated_at: ago(0) }],
      lines: [],
      storeNames: new Map(),
    }),
    ...buildSellerOrderItems({
      orders: [{ id: "p", status: "paid", total_kobo: 1, ship_to: null, updated_at: ago(0) }],
      payments: [],
      lines: [],
    }),
  ];

  test("each tab shows its own kinds; All shows everything", () => {
    expect(filterActivity(items, "all")).toHaveLength(4);
    expect(filterActivity(items, "followers").map((item) => item.kind)).toEqual(["follow"]);
    expect(filterActivity(items, "messages").map((item) => item.kind)).toEqual(["messages"]);
    expect(filterActivity(items, "orders").map((item) => item.kind)).toEqual([
      "my-order",
      "store-order",
    ]);
  });
});

describe("unseen", () => {
  const items = [follow("a", ago(MIN)), follow("b", ago(HOUR)), follow("c", ago(DAY))];

  test("counts what arrived after the last visit", () => {
    expect(countUnseen(items, NOW - 2 * HOUR)).toBe(2);
    expect(countUnseen(items, NOW)).toBe(0);
    expect(isUnseen(items[0], NOW - 2 * MIN)).toBe(true);
    expect(isUnseen(items[1], NOW - 2 * MIN)).toBe(false);
  });

  test("never visited means everything is unseen", () => {
    expect(countUnseen(items, null)).toBe(3);
  });

  test("the watermark never trails an item stamped ahead of a slow device clock", () => {
    const ahead = follow("z", new Date(NOW + 5 * MIN).toISOString());
    expect(seenWatermark([ahead, ...items], NOW)).toBe(NOW + 5 * MIN);
    expect(seenWatermark(items, NOW)).toBe(NOW);
    expect(countUnseen([ahead], seenWatermark([ahead], NOW))).toBe(0);
  });
});

describe("groupActivity", () => {
  // Local-time anchors, since the buckets follow the phone's calendar day.
  const noon = new Date(2026, 9, 8, 12, 0).getTime();
  const at = (ms: number) => new Date(ms).toISOString();

  test("splits new, today, this week, this month and earlier", () => {
    const items = [
      follow("new", at(noon - 10 * MIN)),
      follow("today", at(noon - 3 * HOUR)),
      follow("week", at(noon - 3 * DAY)),
      follow("month", at(noon - 20 * DAY)),
      follow("old", at(noon - 90 * DAY)),
    ];
    const groups = groupActivity(items, noon - HOUR, noon);
    expect(groups.map((group) => [group.label, group.items.map((item) => item.key)])).toEqual([
      ["New", ["follow:new"]],
      ["Today", ["follow:today"]],
      ["This week", ["follow:week"]],
      ["This month", ["follow:month"]],
      ["Earlier", ["follow:old"]],
    ]);
  });

  test("a first visit gets no New group, just the calendar", () => {
    const groups = groupActivity([follow("a", at(noon - MIN))], null, noon);
    expect(groups.map((group) => group.label)).toEqual(["Today"]);
  });

  test("empty groups are dropped", () => {
    expect(groupActivity([], noon, noon)).toEqual([]);
  });
});

describe("last-seen storage", () => {
  test("keyed per account", () => {
    expect(lastSeenStorageKey("u1")).not.toBe(lastSeenStorageKey("u2"));
  });

  test("garbage reads as never seen", () => {
    expect(parseLastSeen(null)).toBeNull();
    expect(parseLastSeen("")).toBeNull();
    expect(parseLastSeen("abc")).toBeNull();
    expect(parseLastSeen("-5")).toBeNull();
    expect(parseLastSeen("1760000000000")).toBe(1_760_000_000_000);
  });
});

describe("sourcesForFilter", () => {
  test("a tab only answers for the sources it is built from", () => {
    expect(sourcesForFilter("followers")).toEqual(["followers"]);
    expect(sourcesForFilter("messages")).toEqual(["messages"]);
    expect(sourcesForFilter("orders")).toEqual(["orders", "store-orders"]);
    expect(sourcesForFilter("all")).toHaveLength(4);
  });
});
