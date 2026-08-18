export type ThemeId = "motion" | "banner" | "story" | "atelier" | "circuit";

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
    id: "story",
    name: "Interactive Story",
    eyebrow: "SOCIAL · EXPRESSIVE · ENGAGING",
    description: "Turn products, campaigns, and creator moments into a living feed.",
    accent: "#ec4b9a",
    demoBrand: "Sunday Social",
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
];
