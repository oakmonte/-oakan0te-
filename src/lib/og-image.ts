// Link-preview images for the landing pages (WhatsApp, iMessage, X, etc.).
// Crawlers need absolute URLs, so these point at the production domain.
// The JPGs in public/og/ are 1200x630 captures of each page's own hero --
// recapture them when a hero changes, or the preview goes stale again.
const ORIGIN = "https://oakmonte.store";

export function ogImageMeta(file: "home" | "sellers" | "creators", alt: string) {
  const url = `${ORIGIN}/og/${file}.jpg`;
  return [
    { property: "og:image", content: url },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: alt },
    { name: "twitter:image", content: url },
  ];
}
