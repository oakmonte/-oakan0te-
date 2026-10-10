// Parts of the product form that are switched off for now (2026-10-10).
//
// Necessities (material, colours, weight, size chart, linked content) comes
// back once there are more sellers and the smart size chart is trained; tags
// with it. Everything behind these flags is still built and still saves what
// a draft already carries -- flip a flag to true and it's back on both the
// new and edit product pages, nothing else to undo.
//
// With Necessities off, a single-variant product's weight isn't asked for:
// delivery is priced at the shipping default (0.5 kg, shipping.server.ts).
// Variant products still set weight on the last variant page.
export const NECESSITIES_ENABLED = false;
export const TAGS_ENABLED = false;
