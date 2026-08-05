# Niche picker redesign

Rework `/creator-niche` so the chip list lives in its own scrollable, rounded card with a sticky search bar, and expand the list of suggested niches.

## Layout

```text
  What's your niche?            <- stays outside the card
  Pick as many as fit...        <- stays outside the card

  +--------------------------------+
  | [ search or add your own ] [+] |  <- sticky inside card
  |--------------------------------|
  | (chip) (chip) (chip) (chip)    |  <- scrolls under the search bar
  | (chip) (chip) (chip)  ...      |
  +--------------------------------+

  [        CONTINUE         ]        <- stays outside the card

## Changes

- Wrap the search field and chip grid in a single container with large rounded corners (`rounded-3xl`), a soft border, and subtle inner padding — matching the cream/black/gold palette already in use.
- Search row becomes `sticky top-0` inside the card with a matching background so chips scroll behind it cleanly.
- Chip area gets a capped height (roughly 50-55vh) with vertical scrolling, so the heading, subtext and Continue button stay fixed on screen and never push out of view.
- Chips left-aligned in the scroll area instead of centered, for a tighter grid at more options.
- Selected chips keep the current filled black/cream treatment.

## Expanded niche list

Add to the existing 17 options: Content creation/UGC, Nail artistry, Skincare/beauty, Fragrance, Interior/space styling, Footwear design, Leatherwork, Knitwear/crochet, Embroidery/beadwork, Textile/print design, Costume design, Art direction, Creative direction, Casting, Modelling agency scouting, Music/sound, Dance/performance, Food styling, Event/experience design, Brand strategy, Copywriting, Community building, Fitness/wellness, Travel, Vintage sourcing, Streetwear, Menswear, Womenswear, Kidswear, Bridal, Tailoring/alterations, Print/zines, Digital art/3D, Motion graphics, Ceramics, Woodwork, Metalwork/welding, Candle/home fragrance making.

Also: typing in the search box filters the visible chips (currently it only adds custom values); the "+" still adds a custom niche when no match exists.

## Technical notes

Single-file change to `src/routes/creator-niche.tsx`. No backend or data-model changes — selections still go to `sessionStorage` and navigate to `/find-your-fit`.
