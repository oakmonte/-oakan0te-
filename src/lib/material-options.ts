// Material vocabulary, shared between OptionEditorSheet's Material preset
// chips (a variant option axis) and MaterialSheet (a regular product's single
// material field) — one list, not two that can drift apart.
//
// Grouped rather than category-scoped on purpose: a seller whose category is
// slightly off still finds the right word, and neither caller has to keep a
// category→group map in step with categories.ts. Groups are display order.
//
// Spellings are chosen to match weight-estimate.ts's GSM keywords, which are
// substring-matched — so "Pique", not "Piqué" (the accented form contains no
// "pique" substring and would silently produce no weight estimate), and
// "Cotton rib" rather than "Rib knit". If you add a fabric here, check
// guessGsmForMaterial recognises it, or accept that it reports "we don't know
// how heavy that is yet".
export type MaterialGroup = { label: string; materials: string[] };

export const MATERIAL_GROUPS: MaterialGroup[] = [
  {
    label: "Fabrics",
    materials: [
      "Cotton",
      "Cotton blend",
      "Jersey",
      "Twill",
      "Poplin",
      "Chambray",
      "Flannel",
      "Fleece",
      "French terry",
      "Pique",
      "Cotton rib",
      "Mesh",
      "Linen",
      "Silk",
      "Satin",
      "Chiffon",
      "Georgette",
      "Crepe",
      "Organza",
      "Tulle",
      "Lace",
      "Velvet",
      "Corduroy",
      "Tweed",
      "Wool",
      "Cashmere",
      "Polyester",
      "Nylon",
      "Spandex",
      "Viscose",
      "Modal",
      "Bamboo",
      "Acrylic",
      "Denim",
      "Canvas",
    ],
  },
  {
    // The market this app is built for. Ankara, Adire and Batik are printed
    // or dyed cotton and do get a weight estimate; the handwoven and beaded
    // cloths below deliberately don't (see GSM_KEYWORDS' comment) — they're
    // here because a seller still needs the right word to tap.
    label: "Nigerian & African",
    materials: [
      "Ankara",
      "Adire",
      "Batik",
      "Guinea brocade",
      "Damask",
      "Aso oke",
      "Kente",
      "George",
      "Akwete",
      "Senator",
    ],
  },
  {
    label: "Leather & synthetics",
    materials: [
      "Leather",
      "Suede",
      "Faux leather",
      "PU leather",
      "Patent leather",
      "Nubuck",
      "Rubber",
      "EVA foam",
      "Neoprene",
      "Vinyl",
    ],
  },
  {
    label: "Metals & gemstones",
    materials: [
      "Gold",
      "Gold-plated",
      "Silver",
      "Sterling silver",
      "Stainless steel",
      "Brass",
      "Copper",
      "Bronze",
      "Iron",
      "Titanium",
      "Platinum",
      "Pearl",
      "Beads",
      "Cubic zirconia",
      "Crystal",
      "Shell",
    ],
  },
  {
    label: "Art, craft & home",
    materials: [
      "Wood",
      "Ceramic",
      "Porcelain",
      "Clay",
      "Marble",
      "Stone",
      "Glass",
      "Resin",
      "Paper",
      "Raffia",
      "Straw",
      "Jute",
      "Cork",
      "Felt",
      "Wax",
      "Concrete",
    ],
  },
];

export const MATERIAL_PRESETS: string[] = MATERIAL_GROUPS.flatMap((g) => g.materials);
