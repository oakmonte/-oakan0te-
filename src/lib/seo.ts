// Shared SEO facts: the production origin, the /learn articles, and the
// JSON-LD builders. /learn pages, llms.txt and the sitemap all read from here,
// so an article added once shows up in the page, the sitemap and llms.txt.
//
// Only claim what the product does today. These pages are quoted by search
// engines and AI assistants, so a wrong sentence here gets repeated for us.

export const ORIGIN = "https://oakmonte.store";

export const SITE_DESCRIPTION =
  "Oakmonte is a content-driven fashion marketplace for vetted sellers, honest creators and style curators, built for sellers in Nigeria and across Africa.";

export type LearnArticle = {
  slug: string;
  title: string;
  /** Meta description + the card blurb on /learn. */
  description: string;
  /** ISO date; bump when the content changes. */
  updated: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
  faq: { q: string; a: string }[];
};

export const LEARN_ARTICLES: LearnArticle[] = [
  {
    slug: "how-to-get-a-website-for-your-fashion-brand-in-nigeria",
    title: "How to get a website for your fashion brand in Nigeria",
    description:
      "Three ways a Nigerian fashion seller can get an online store: build one, rent one, or open a storefront on a marketplace. What each costs you in time, money and effort.",
    updated: "2026-10-08",
    intro:
      "If you sell fashion from Instagram or WhatsApp, a website gives customers one place to see everything, pay, and trust you. You do not need to know how to code to get one. There are three realistic routes.",
    sections: [
      {
        heading: "Option 1: Build a custom website",
        paragraphs: [
          "A developer builds a site for you. You get full control, but you pay for the build, hosting, a domain, and every change afterwards. You also have to wire up payments and delivery yourself. This suits an established brand with a budget and a clear brief, not someone testing a new line.",
        ],
      },
      {
        heading: "Option 2: Rent a store builder",
        paragraphs: [
          "Store builders such as Shopify or Bumpa give you a template and a dashboard. You pay a recurring plan, you set up the products, and you drive your own traffic. It is the most common route and works well once you already have steady customers.",
        ],
      },
      {
        heading: "Option 3: Open a storefront on a marketplace",
        paragraphs: [
          "A marketplace gives you a ready storefront and an audience that is already browsing. On Oakmonte, you set up a customizable storefront, list products with photos and short videos, and customers can discover you through posts as well as through your own link. Oakmonte charges 0% commission.",
          "You can also import an existing catalogue from Shopify, Bumpa, Instagram or a CSV file, so you are not retyping products.",
        ],
      },
      {
        heading: "Which one should you pick?",
        paragraphs: [
          "If you are just starting or testing products, start with a marketplace storefront: it is fast and you do not pay upfront. If you already have steady orders and want your own domain and full control, a store builder or custom site makes sense. Many sellers do both: a marketplace for discovery and their own link for repeat customers.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I get a website for my fashion brand without coding?",
        a: "Yes. A marketplace storefront like Oakmonte or a store builder gives you a ready-made shop you customize, with no code needed.",
      },
      {
        q: "How much does it cost to start an online fashion store in Nigeria?",
        a: "A custom site has the highest upfront cost. Store builders charge a recurring plan. Oakmonte charges 0% commission on sales.",
      },
      {
        q: "Can I move my products from Instagram or Shopify?",
        a: "Yes. Oakmonte can import a catalogue from Shopify, Bumpa, Instagram or a CSV file.",
      },
    ],
  },
  {
    slug: "sell-fashion-on-instagram-without-a-website",
    title: "How to sell fashion on Instagram without a website",
    description:
      "Selling from Instagram DMs works until orders pile up. How to keep Instagram as your shop window while taking payments and tracking orders in one place.",
    updated: "2026-10-08",
    intro:
      "Instagram is where many Nigerian fashion brands find customers. The problem comes after the DM: sending account numbers, chasing receipts, and losing track of who ordered what. You can keep Instagram and still stop running the shop out of your inbox.",
    sections: [
      {
        heading: "Why DM-only selling breaks down",
        paragraphs: [
          "Every sale needs several messages: size, colour, price, delivery address, payment proof. Once you pass a handful of orders a day, mistakes creep in and customers who cannot see a clear price or stock status move on.",
        ],
      },
      {
        heading: "Keep Instagram as the shop window",
        paragraphs: [
          "Post as you do now, but point every post and your bio link to one storefront where products, prices, sizes and stock are listed. The customer picks and pays there instead of negotiating in DMs.",
        ],
      },
      {
        heading: "Bring your products over",
        paragraphs: [
          "On Oakmonte you can connect Instagram and import your products rather than retyping them, then edit prices, sizes and variants. Customers can also discover you through short fashion posts on Oakmonte itself.",
        ],
      },
      {
        heading: "Take payments and ship from one place",
        paragraphs: [
          "Checkout, payments and delivery are handled in the same flow, so you stop copying addresses out of chats. Customers see the same price you do.",
        ],
      },
    ],
    faq: [
      {
        q: "Do I need a website to sell on Instagram?",
        a: "No, but a storefront link in your bio makes ordering much easier than DMs. A marketplace storefront gives you one without building a website.",
      },
      {
        q: "Can I import my Instagram products into Oakmonte?",
        a: "Yes. Connect your Instagram account and Oakmonte can import your products for you to edit.",
      },
    ],
  },
  {
    slug: "oakmonte-vs-shopify-and-bumpa",
    title: "Oakmonte vs Shopify and Bumpa for Nigerian fashion sellers",
    description:
      "How Oakmonte compares with Shopify and Bumpa: storefront ownership, discovery, fees and who each is best for.",
    updated: "2026-10-08",
    intro:
      "Shopify and Bumpa are store builders: you rent software and bring your own customers. Oakmonte is a marketplace: you get a storefront plus an audience that discovers sellers through fashion content. They solve different problems, and plenty of sellers use more than one.",
    sections: [
      {
        heading: "What a store builder gives you",
        paragraphs: [
          "Shopify and Bumpa give you a store you fully own, usually on your own domain. In return you pay a plan and you are responsible for getting visitors to the store.",
        ],
      },
      {
        heading: "What Oakmonte gives you",
        paragraphs: [
          "A customizable storefront, posts and short videos that put your products in front of shoppers who are browsing fashion, and 0% commission on sales. Sellers are vetted, which helps buyers trust a new brand.",
        ],
      },
      {
        heading: "Using them together",
        paragraphs: [
          "Oakmonte can import a catalogue from Shopify or Bumpa, so you can list the same products without retyping them. Use the marketplace for discovery and your own site for repeat customers.",
        ],
      },
    ],
    faq: [
      {
        q: "Is Oakmonte a replacement for Shopify?",
        a: "Not exactly. Shopify is a store builder you pay to rent; Oakmonte is a marketplace with a storefront and built-in discovery. Many sellers use both.",
      },
      {
        q: "Can I import my Shopify or Bumpa products to Oakmonte?",
        a: "Yes, Oakmonte supports importing from Shopify and Bumpa.",
      },
    ],
  },
];

export function getArticle(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((a) => a.slug === slug);
}

/** Static pages that belong in the sitemap and llms.txt. */
export const PUBLIC_PAGES: { path: string; label: string; blurb: string }[] = [
  { path: "/", label: "Oakmonte home", blurb: "What Oakmonte is." },
  { path: "/sellers", label: "Sell on Oakmonte", blurb: "Open a storefront and start selling." },
  {
    path: "/creators",
    label: "Become a creator",
    blurb: "Earn by showing fashion you believe in.",
  },
  {
    path: "/learn",
    label: "Guides for sellers",
    blurb: "How to get an online store for your fashion brand.",
  },
];

// ---- JSON-LD -------------------------------------------------------------

export function jsonLdScript(data: unknown) {
  return {
    type: "application/ld+json",
    // `<` is escaped so a stray "</script>" in content cannot end the tag.
    children: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${ORIGIN}/#org`,
      name: "Oakmonte",
      url: ORIGIN,
      logo: `${ORIGIN}/favicon.png`,
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${ORIGIN}/#site`,
      url: ORIGIN,
      name: "Oakmonte",
      publisher: { "@id": `${ORIGIN}/#org` },
    },
  ],
};

export function articleJsonLd(a: LearnArticle) {
  const url = `${ORIGIN}/learn/${a.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: a.title,
        description: a.description,
        dateModified: a.updated,
        mainEntityOfPage: url,
        author: { "@id": `${ORIGIN}/#org` },
        publisher: { "@id": `${ORIGIN}/#org` },
      },
      {
        "@type": "FAQPage",
        mainEntity: a.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

export function canonicalLink(path: string) {
  return { rel: "canonical", href: `${ORIGIN}${path === "/" ? "" : path}` };
}
