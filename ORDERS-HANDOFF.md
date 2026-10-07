# Orders / checkout / delivery build: handoff (2026-10-07)

Branch `feature/orders-checkout`, worktree `../oakmonte-orders` (from origin/main c86d872).
`node_modules` is a junction to the main checkout; `core.hooksPath` set to `.githooks`.
Rules: develop here only, test on this branch's own Vercel preview, **pull `origin/main` into
this branch often** (merge, never rebase or force-push), merge to `main` only when fully working
and typecheck/lint/tests/build pass. Never apply SQL to the live DB without telling Diadem; use a
Supabase branch for testing if possible.

## Why this exists
Paystack can't be used yet: marketplaces must be a *Registered Business* (Paystack's own
"Supported businesses" page); CAC is in progress and its nature of business is currently
"general merchandise" (suggest amending to cover running a marketplace platform). Starter
Business (₦8m lifetime cap, personal account) is not allowed for marketplaces. Flutterwave,
Squad, Monnify were checked: all have split/sub-account features but none of their public
pages say marketplaces are allowed on unregistered accounts. Diadem refuses to email anyone.
Squad dynamic virtual accounts need approval + a GTBank account. Monnify sub-accounts are off
until enabled by their support. Superwall is NOT a payments tool; Chowdeck service unverified.

## What exists in the repo today
No cart, orders table, or checkout. `/cart` and `/store/orders` are placeholders.
`src/routes/api.shipbubble.ping.ts` is a key-check only (SHIPBUBBLE_API_KEY env var).
`store_locations` (pickup locations with coordinates) and per-variant `weight_grams` exist.
Seller payout account is stored (`api.store.payout.ts`), nothing verified.

## Decided direction
- Payments: **order flow first, gateway swappable.** Interim bridge: buyer pays by transfer;
  Diadem wants money to come to Oakmonte ("can't trust both sides") but also wants a design
  that avoids holding seller funds. Last stated preference: option 3 (Oakmonte collects, pays
  sellers and riders manually) vs option 2 (item price to seller directly, delivery fee to
  Oakmonte). Diadem then said "let's just do live courier now". **Confirm the payer split
  before building the payment step.**
- Delivery: **Live courier rates via Shipbubble**, modelled on a competitor's (Labeld)
  Shipping Settings: strategies Flat Rate, Location-based (per region), Live Courier; Local
  Pickup toggle; default package weight (kg); required default pickup address; international
  needs flat/location fallback.
- Address: use Shipbubble's own "Validate address (global)" endpoint first (inputs/outputs not
  yet read). Google Maps only if that can't cover it. OSM Nominatim is already used for
  pickup locations (legal review flagged calling it from the browser).
- Flow: buyer enters address, picks courier from live rates, order created "awaiting
  payment"; seller accepts/declines; payment confirmed; courier booked from a funded
  Shipbubble wallet. Booking stubbed/manual until wallet funded and payment confirmed.

## Build order
1. Read Shipbubble docs: address validation, rates, shipment/label, wallet, webhooks.
2. Orders migration (orders, order_items, payments, rider/courier ledger) with RLS from the
   start. Write only; do not apply.
3. Seller shipping settings page (strategy, pickup address, default weight, pickup toggle).
4. Buyer checkout: address, validated, rates, courier choice, accept-then-pay.
5. Seller `/store/orders`: new, accept/decline, confirm payment, shipped.
6. Swap in a gateway checkout once one is approved; Paystack split payments when CAC lands.

## Conventions to keep
Seller screens use `--sd-*` tokens; bun not npm; `bunx prettier --write <changed files>` only;
`bun run typecheck`, `bun run lint`, `bun test src`, `bun run build` before merging; commit
messages end with the Co-Authored-By line; flag any unapplied migration after every merge.

## Shipbubble API facts (read 2026-10-07 from docs.shipbubble.com/llms-full.txt)
Base `https://api.shipbubble.com/v1`, `Authorization: Bearer <key>`; keys `sb_sandbox…` (test) / `sb_prod…` (live).
Response envelope `{status, message, data, errors}`.
- Validate address: `POST /shipping/address/validate` {name,email,phone,address,[latitude,longitude]} -> `address_code`, formatted_address, country/state/city codes, lat/lng, postal_code. (So Google Maps likely unnecessary; pass lat/lng if we have them.)
- Rates: `POST /shipping/fetch_rates` {sender_address_code, reciever_address_code (sic), pickup_date yyyy-mm-dd (max 7d ahead; after 6pm GMT+1 rolls to next day), category_id (from `GET /shipping/labels/categories`), package_items[{name,description,unit_weight KG,unit_amount NGN,quantity}], package_dimension{length,width,height CM}, [delivery_instructions]}
  -> `request_token` (7d), couriers[{service_code, courier_id, total (wallet debit), rate_card_amount (show to buyer), delivery_eta_time, pickup_eta_time, is_cod_available, tracking_level}], fastest_courier, cheapest_courier. Filtered: `/shipping/fetch_rates/:service_codes`.
- Book: `POST /shipping/labels` {request_token, service_code, courier_id, [insurance_code,is_cod_label,duties_paid]} -> order_id (SB-…), status, courier, ship_from/to, payment, tracking_url. Debits the wallet.
- Wallet: `GET /shipping/wallet/balance`; `POST /shipping/wallet/fund` {amount} -> Paystack payment_url (prod key only).
- Webhooks: shipment.label.created / status.changed / cancelled / cod.remitted / sla.updated / waybill.updated, wallet.*; verify header `x-ship-signature` = HMAC-SHA512 of body keyed with API key. Sandbox simulator `POST /shipping/labels/webhooks/:order_id` {status_code}.
Statuses: pending, confirmed, picked_up, in_transit, completed, cancelled.
