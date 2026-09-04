// PLACEHOLDER DATA — not a fixture, not seeded, not read from Supabase.
//
// The "link a product from someone else's store" flow needs a store directory
// to design against, and there are only a couple of real stores in the
// database. These stand in so the browse screen can be built and looked at
// properly. Nothing here is wired to anything: the collaborator relationship
// this flow depends on (approved by a store, or a request sent to it) doesn't
// exist yet, and cross-store linking is deliberately out of scope for the
// first public version.
//
// DELETE this file the moment `stores` + a collaborators table can answer the
// same questions — every consumer should read the real tables instead.

export type FakeStoreProduct = {
  id: string;
  title: string;
  price: number;
  image: string;
};

export type FakeStore = {
  id: string;
  brand_name: string;
  store_username: string;
  avatar: string;
  category: string;
  productCount: number;
  followers: string;
  /** How this store stands toward you. Drives the pill on the row, and is the
   *  shape the real collaborator check will return: an approved store lets you
   *  link straight away, a pending one is waiting on them, and everything else
   *  needs a request first. */
  relation: "approved" | "pending" | "none";
  products: FakeStoreProduct[];
};

export const FAKE_STORES: FakeStore[] = [
  {
    id: "fs-1",
    brand_name: "Ladi Studios",
    store_username: "ladistudios",
    avatar: "https://placehold.co/96x96/1f1f22/8a8a90?text=LS",
    category: "Womenswear",
    productCount: 48,
    followers: "12.4k",
    relation: "approved",
    products: [
      {
        id: "fs-1-p1",
        title: "Cropped linen shirt",
        price: 28000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=1",
      },
      {
        id: "fs-1-p2",
        title: "Wide-leg trouser",
        price: 42000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=2",
      },
      {
        id: "fs-1-p3",
        title: "Silk slip dress",
        price: 65000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=3",
      },
    ],
  },
  {
    id: "fs-2",
    brand_name: "Thenextbigthing",
    store_username: "thenextbigthing",
    avatar: "https://placehold.co/96x96/1f1f22/8a8a90?text=TB",
    category: "Streetwear",
    productCount: 12,
    followers: "3.1k",
    relation: "pending",
    products: [
      {
        id: "fs-2-p1",
        title: "Boxy graphic tee",
        price: 20000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=1",
      },
      {
        id: "fs-2-p2",
        title: "Washed cargo short",
        price: 32000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=2",
      },
    ],
  },
  {
    id: "fs-3",
    brand_name: "Ori Atelier",
    store_username: "oriatelier",
    avatar: "https://placehold.co/96x96/1f1f22/8a8a90?text=OA",
    category: "Tailoring",
    productCount: 31,
    followers: "8.9k",
    relation: "none",
    products: [
      {
        id: "fs-3-p1",
        title: "Double-breasted blazer",
        price: 120000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=1",
      },
      {
        id: "fs-3-p2",
        title: "Pleated wool trouser",
        price: 58000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=2",
      },
      {
        id: "fs-3-p3",
        title: "Camp-collar shirt",
        price: 34000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=3",
      },
      {
        id: "fs-3-p4",
        title: "Overcoat",
        price: 185000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=4",
      },
    ],
  },
  {
    id: "fs-4",
    brand_name: "Kanwa",
    store_username: "kanwa",
    avatar: "https://placehold.co/96x96/1f1f22/8a8a90?text=KA",
    category: "Accessories",
    productCount: 22,
    followers: "5.6k",
    relation: "none",
    products: [
      {
        id: "fs-4-p1",
        title: "Beaded chain necklace",
        price: 8000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=1",
      },
      {
        id: "fs-4-p2",
        title: "Raffia tote",
        price: 26000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=2",
      },
    ],
  },
  {
    id: "fs-5",
    brand_name: "Ember & Ash",
    store_username: "emberandash",
    avatar: "https://placehold.co/96x96/1f1f22/8a8a90?text=EA",
    category: "Footwear",
    productCount: 17,
    followers: "2.2k",
    relation: "approved",
    products: [
      {
        id: "fs-5-p1",
        title: "Leather mule",
        price: 47000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=1",
      },
      {
        id: "fs-5-p2",
        title: "Canvas low-top",
        price: 30000,
        image: "https://placehold.co/96x96/2a2a2e/8a8a90?text=2",
      },
    ],
  },
];

export const STORE_FILTERS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
] as const;

export type StoreFilterKey = (typeof STORE_FILTERS)[number]["key"];
