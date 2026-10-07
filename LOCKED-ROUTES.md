# Locked / unbuilt features (found 2026-10-07 by searching the code)

Everything here gets built on `feature/orders-checkout` (or lane branches off it) and merges to
`main` together, when the whole app works and Paystack is live. Nothing opens on `main` before then.

## Done on this branch
- Home: Explore tab = real posts wall + the swipeable post viewer; Shop tab = feature banner,
  New arrivals / On sale shelves, All pieces grid (`src/components/home/`). Tap a piece = product page.
- Product page, guest-friendly checkout, live courier prices, order creation + Paystack init,
  signed webhook, order status page, seller `/store/orders` with courier booking.

## Buyer side, still locked
| Where | What | Notes |
|---|---|---|
| `/cart` | placeholder page | Needs a cart table or local cart; Add to Bag feeds it |
| Product page | Add to Bag, Make Offer | Show the "not open yet" notice today. Make Offer needs sign-in |
| Feed "cart" rail button | "Cart is unavailable for now" | `components/feed/PostFeed.tsx` |
| Messages | "New chats are unavailable for now" | `routes/messages.tsx` |
| Post publish | "Tagging people is unavailable" | `routes/create.after-shot.publish.tsx` |
| Link products sheet | other stores' products ("advertising") | `components/feed/LinkProductsSheet.tsx` |
| Home top bar | wallet + search buttons do nothing | `components/TopToggleNav.tsx` |
| Home | Following feed on the Shop tab, store hero from the Figma frames | Figma file key needed |
| Orders | order history for signed-in buyers, emails | order page is link-only today |

## Seller side, still locked
| Where | What |
|---|---|
| `/store/content`, `/store/customers`, `/store/discounts`, `/store/growth` | "coming soon" screens |
| Seller dashboard | share-store-link banner ("after official launch") |
| New | shipping settings page (flat / by state / live courier, pickup address, default weight) |
| New | decline + refund an order, payout to seller bank (Paystack subaccount + 6% fee) |

## Platform
- Custom domains and `*.oakmonte.store` subdomains: not built (no host routing, no domain table).
- 14 tables still have RLS off (see `POSTPONED.md` section 1.1): `stores`, `products`,
  `product_variants`, options, collections, tags, `store_locations`, stock, measurements,
  theme customisations. Must be fixed before launch.
- Paystack live keys wait on CAC. Shipbubble live key waits on verification. Both are test keys now.
- The Shipbubble delivered-webhook payload shape is from the docs, not yet seen in a real event.
