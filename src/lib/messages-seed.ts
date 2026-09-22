/**
 * Local seed data for the /messages surface.
 *
 * There is no `conversations` / `messages` schema yet. Every object below is
 * shaped like a row that could come out of Postgres later (`id`, `thread_id`,
 * `sender`, ISO `created_at`) so swapping in a real query is a one-line change.
 * `support_messages` is the only real table and it is NOT modelled here.
 *
 * Deleting this file (plus its imports) removes all of the fake data.
 */
// Real files, imported by path so Vite bundles them. These used to be
// `*.asset.json` sidecars holding a Lovable `/__l5e/...` URL, which 404s now
// that we are on Vercel. streetwear-summerstyle.jpeg had no file behind it at
// all -- it only ever lived in Lovable's bucket -- so it is gone for good and
// the two seeds that used it fall back to fabricDetail.
import fabricDetail from "@/assets/fabric-detail.jpg";
import editorial from "@/assets/hero-editorial.jpg";

export type FilterKey =
  | "unread"
  | "unanswered"
  | "flagged"
  | "booked"
  | "ordered"
  | "paid"
  | "dispatched"
  | "lead";

export type MessageSender = "user" | "contact";

export type SeedProduct = {
  id: string;
  name: string;
  price: string;
  store: string;
  image: string;
};

export type SeedMessage = {
  id: string;
  thread_id: string;
  sender: MessageSender;
  created_at: string;
  kind: "text" | "product" | "offer" | "order";
  body?: string;
  reply_to_body?: string;
  product?: SeedProduct;
  offer?: {
    amount: string;
    listPrice: string;
    expiresIn: string;
    image: string;
    title: string;
  };
  order?: {
    code: string;
    title: string;
    image: string;
    step: 0 | 1 | 2;
  };
};

export type ConversationKind = "support" | "self" | "person" | "store";

export type Conversation = {
  id: string;
  name: string;
  handle?: string;
  initials: string;
  avatar?: string;
  kind: ConversationKind;
  verified: boolean;
  hasStory: boolean;
  /** `null` = no presence line, `0` = active now, otherwise minutes since active. */
  activeMinutesAgo: number | null;
  businessChat: boolean;
  unread: number;
  typing: boolean;
  preview: string;
  previewFromMe: boolean;
  previewStatus: "sent" | "delivered" | "seen";
  last_message_at: string;
  tags: FilterKey[];
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "support",
    name: "Oakmonte Support",
    initials: "O",
    kind: "support",
    verified: true,
    hasStory: false,
    activeMinutesAgo: 0,
    businessChat: true,
    unread: 0,
    typing: false,
    preview: "Make complaints or observations",
    previewFromMe: false,
    previewStatus: "seen",
    last_message_at: minutesAgo(9),
    tags: [],
  },
  {
    id: "me",
    name: "Me",
    initials: "M",
    kind: "self",
    verified: false,
    hasStory: false,
    activeMinutesAgo: null,
    businessChat: false,
    unread: 0,
    typing: false,
    preview: "A quiet place for your thoughts",
    previewFromMe: false,
    previewStatus: "seen",
    last_message_at: minutesAgo(180),
    tags: [],
  },
  {
    id: "nia",
    name: "Nia from Lagos",
    handle: "niaonline",
    initials: "N",
    kind: "person",
    verified: false,
    hasStory: true,
    activeMinutesAgo: 0,
    businessChat: false,
    unread: 2,
    typing: true,
    preview: "That blue jacket is everything",
    previewFromMe: false,
    previewStatus: "seen",
    last_message_at: minutesAgo(4),
    tags: ["unread", "unanswered", "lead"],
  },
  {
    id: "gabriel",
    name: "thriftwithgabriel",
    handle: "thriftwithgabriel",
    initials: "TG",
    kind: "store",
    verified: true,
    hasStory: true,
    activeMinutesAgo: 62,
    businessChat: true,
    unread: 1,
    typing: false,
    preview: "No — sold out as stated in caption",
    previewFromMe: false,
    previewStatus: "seen",
    last_message_at: minutesAgo(70),
    tags: ["unread", "flagged"],
  },
  {
    id: "kicks",
    name: "Kicks & Caps Store",
    handle: "kicksandcaps",
    initials: "KC",
    kind: "store",
    verified: true,
    hasStory: false,
    activeMinutesAgo: 240,
    businessChat: true,
    unread: 0,
    typing: false,
    preview: "Dispatched this morning, rider is on the way",
    previewFromMe: false,
    previewStatus: "seen",
    last_message_at: minutesAgo(60 * 26),
    tags: ["ordered", "paid", "dispatched"],
  },
  {
    id: "coolwearz",
    name: "cool_wearz",
    handle: "cool_wearz",
    initials: "CW",
    kind: "store",
    verified: false,
    hasStory: true,
    activeMinutesAgo: 9,
    businessChat: true,
    unread: 0,
    typing: false,
    preview: "Sent you the measurements",
    previewFromMe: true,
    previewStatus: "seen",
    last_message_at: minutesAgo(60 * 24 * 4),
    tags: ["booked"],
  },
  {
    id: "zod",
    name: "zodstores",
    handle: "zodstores",
    initials: "ZS",
    kind: "store",
    verified: true,
    hasStory: false,
    activeMinutesAgo: 2400,
    businessChat: true,
    unread: 0,
    typing: false,
    preview: "Can you hold the cargo till Friday?",
    previewFromMe: true,
    previewStatus: "delivered",
    last_message_at: minutesAgo(60 * 24 * 41),
    tags: ["unanswered", "lead"],
  },
];

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const SEED_MESSAGES: Record<string, SeedMessage[]> = {
  me: [
    {
      id: "me-1",
      thread_id: "me",
      sender: "contact",
      kind: "text",
      body: "Ideas, saved looks, and little reminders live here.",
      created_at: hoursAgo(50),
    },
    {
      id: "me-2",
      thread_id: "me",
      sender: "user",
      kind: "text",
      body: "Remember: the best outfits usually start with one good piece.",
      created_at: hoursAgo(49),
    },
  ],
  nia: [
    {
      id: "nia-1",
      thread_id: "nia",
      sender: "contact",
      kind: "text",
      body: "That blue jacket is everything",
      created_at: hoursAgo(30),
    },
    {
      id: "nia-2",
      thread_id: "nia",
      sender: "user",
      kind: "text",
      body: "Right? I found it on Oakmonte yesterday.",
      created_at: hoursAgo(29.9),
    },
    {
      id: "nia-3",
      thread_id: "nia",
      sender: "user",
      kind: "product",
      created_at: hoursAgo(4),
      product: {
        id: "prod-blue-jacket",
        name: "Washed Denim Jacket",
        price: "₦25,000",
        store: "@thriftwithgabriel",
        image: fabricDetail,
      },
    },
    {
      id: "nia-4",
      thread_id: "nia",
      sender: "contact",
      kind: "offer",
      created_at: hoursAgo(3.4),
      offer: {
        amount: "₦18,000",
        listPrice: "₦25,000",
        expiresIn: "Expires in 6h",
        image: fabricDetail,
        title: "Washed Denim Jacket",
      },
    },
    {
      id: "nia-5",
      thread_id: "nia",
      sender: "contact",
      kind: "text",
      body: "Is it still available in a medium?",
      created_at: hoursAgo(0.3),
    },
  ],
  gabriel: [
    {
      id: "gab-1",
      thread_id: "gabriel",
      sender: "user",
      kind: "text",
      body: "Is this one still available?",
      created_at: hoursAgo(28),
    },
    {
      id: "gab-2",
      thread_id: "gabriel",
      sender: "contact",
      kind: "text",
      body: "No\nSold out as stated in caption",
      reply_to_body: "Is this one still available?",
      created_at: hoursAgo(27.5),
    },
    {
      id: "gab-3",
      thread_id: "gabriel",
      sender: "user",
      kind: "text",
      body: "Ohh kk",
      created_at: hoursAgo(27.4),
    },
    {
      id: "gab-4",
      thread_id: "gabriel",
      sender: "user",
      kind: "text",
      body: "Do you sell skull caps?",
      created_at: hoursAgo(27.3),
    },
    {
      id: "gab-5",
      thread_id: "gabriel",
      sender: "contact",
      kind: "product",
      created_at: hoursAgo(2),
      product: {
        id: "prod-skull-cap",
        name: "Ribbed Skull Cap",
        price: "₦6,500",
        store: "@thriftwithgabriel",
        image: fabricDetail,
      },
    },
    {
      id: "gab-6",
      thread_id: "gabriel",
      sender: "contact",
      kind: "text",
      body: "This one just came in. Want me to hold it?",
      created_at: hoursAgo(1.2),
    },
  ],
  kicks: [
    {
      id: "kicks-1",
      thread_id: "kicks",
      sender: "user",
      kind: "text",
      body: "Paid for the cap set 🙏",
      created_at: hoursAgo(30),
    },
    {
      id: "kicks-2",
      thread_id: "kicks",
      sender: "contact",
      kind: "order",
      created_at: hoursAgo(26),
      order: {
        code: "#OK-2841",
        title: "Two-cap bundle",
        image: editorial,
        step: 1,
      },
    },
    {
      id: "kicks-3",
      thread_id: "kicks",
      sender: "contact",
      kind: "text",
      body: "Dispatched this morning, rider is on the way",
      created_at: hoursAgo(25.8),
    },
  ],
  coolwearz: [
    {
      id: "cool-1",
      thread_id: "coolwearz",
      sender: "contact",
      kind: "text",
      body: "we've got limited stock left",
      created_at: hoursAgo(100),
    },
    {
      id: "cool-2",
      thread_id: "coolwearz",
      sender: "user",
      kind: "text",
      body: "Sent you the measurements",
      created_at: hoursAgo(98),
    },
  ],
  zod: [
    {
      id: "zod-1",
      thread_id: "zod",
      sender: "user",
      kind: "text",
      body: "Can you hold the cargo till Friday?",
      created_at: hoursAgo(24 * 41),
    },
  ],
};

export const SAMPLE_OFFER = {
  buyer: "Nia from Lagos",
  offered: "₦18,000",
  listed: "₦25,000",
  image: fabricDetail,
  title: "Washed Denim Jacket",
};

export const SAMPLE_ORDER = {
  code: "#OK-2841",
  status: "Dispatched",
  image: editorial,
  title: "Two-cap bundle",
};
