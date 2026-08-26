export type ThemeId =
  "motion" | "banner" | "atelier" | "circuit" | "verdant" | "monochrome" | "gilded" | "obsidian";

export type Theme = {
  id: ThemeId;
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
  /** Fictional example brand shown inside the mockup, for flavor. */
  demoBrand: string;
};

export const THEMES: Theme[] = [
  {
    id: "motion",
    name: "Motion Grid",
    eyebrow: "DYNAMIC · BOLD · STREETWEAR",
    description: "Built for drops, statements, and products that need to move fast.",
    accent: "#9c4dff",
    demoBrand: "District 17",
  },
  {
    id: "banner",
    name: "Immersive Banner",
    eyebrow: "PREMIUM · CINEMATIC · REFINED",
    description: "A spacious editorial storefront that puts your world front and centre.",
    accent: "#a67c52",
    demoBrand: "terra",
  },
  {
    id: "atelier",
    name: "Gallery Edit",
    eyebrow: "QUIET · LUXE · CONSIDERED",
    description: "A hushed, gallery-lit storefront for pieces that don't need to shout.",
    accent: "#c9a227",
    demoBrand: "Atelier Noir",
  },
  {
    id: "circuit",
    name: "Neon Terminal",
    eyebrow: "FUTURIST · TECH · HIGH-CONTRAST",
    description: "A HUD-inspired storefront for brands building what's next.",
    accent: "#2dd4ff",
    demoBrand: "Circuit",
  },
  {
    id: "verdant",
    name: "Verdant Noir",
    eyebrow: "BOTANICAL · MOODY · GROUNDED",
    description: "Deep black grounded by a single living green — for brands rooted in craft.",
    accent: "#3fae63",
    demoBrand: "Fern & Co.",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    eyebrow: "STARK · GRAPHIC · TIMELESS",
    description: "Just black and white — nothing to distract from the product.",
    accent: "#111111",
    demoBrand: "NOIR/BLANC",
  },
  {
    id: "gilded",
    name: "Gilded",
    eyebrow: "OPULENT · RICH · REGAL",
    description: "Black lacquered in gold, for stores that want to feel like an occasion.",
    accent: "#d4af37",
    demoBrand: "Aurum House",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    eyebrow: "MINIMAL · MONOLITHIC · SEVERE",
    description: "One shade of black, layered on itself — as pared-back as a storefront gets.",
    accent: "#6b6b6b",
    demoBrand: "VOID",
  },
];
