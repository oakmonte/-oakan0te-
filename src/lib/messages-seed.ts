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
// that we are on Vercel.
import editorial from "@/assets/hero-editorial.jpg";
import streetwear from "@/assets/streetwear-summerstyle.jpeg";

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

// Only the two threads every account starts with: Oakmonte Support and your
// own "Me" notes. There used to be five invented people and stores here too
// (Nia, thriftwithgabriel, …) with fake unread counts and typing dots, which
// read as real conversations to anyone opening the inbox before launch.
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
};

export const SAMPLE_OFFER = {
  buyer: "Nia from Lagos",
  offered: "₦18,000",
  listed: "₦25,000",
  image: streetwear,
  title: "Washed Denim Jacket",
};

export const SAMPLE_ORDER = {
  code: "#OK-2841",
  status: "Dispatched",
  image: editorial,
  title: "Two-cap bundle",
};
