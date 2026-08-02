# Mass Media Upload — Shopify + Bumpa

Bulk-uploads local image/video files and attaches them to product listings on
Shopify and Bumpa, via a queued pipeline built for thousands of items.

## Why a queue instead of a simple upload loop

At "thousands+ products," a naive `for` loop hitting each platform's API will
hit rate limits, tie up a single request/response cycle for the whole batch,
and lose all progress if it crashes partway through. This uses BullMQ (backed
by Redis) so that:

- Each file→product upload is its own retryable job (5 attempts, exponential
  backoff) — a transient 429 or network blip doesn't kill the whole batch.
- Shopify and Bumpa get **separate queues with separate concurrency limits**,
  so one platform's rate limit doesn't stall the other.
- Every job's status (queued/processing/done/failed) is tracked in SQLite, so
  you can check progress on a 5,000-item batch without holding anything in
  memory, and can inspect exactly which items failed and why.
- The API server (accepts uploads) and the worker (does the slow network
  calls) are separate processes — you can scale worker concurrency
  independently of the ingest endpoint.

## Setup

Written in TypeScript throughout (Express, adapters, queue, worker, DB layer
all `.ts`, `strict` mode on).

```bash
npm install
cp .env.example .env   # fill in Shopify token, Bumpa key, Redis URL
```

You need a running Redis instance (`redis-server` locally, or any managed
Redis). SQLite is file-based, no separate service needed.

**Development** (two terminals, hot-reload via `tsx`):

```bash
npm run dev          # API server on PORT (default 3000)
npm run worker:dev
```

**Production build:**

```bash
npm run build         # compiles src/**/*.ts -> dist/
npm start             # runs dist/server.js
npm run worker        # runs dist/workers/mediaWorker.js, separately
```

`npm run typecheck` runs `tsc --noEmit` if you just want to verify types
without emitting.

## Usage

```bash
curl -X POST http://localhost:3000/uploads/batch \
  -F "files=@./photo1.jpg" \
  -F "files=@./clip1.mp4" \
  -F 'mapping=[
        {"shopifyProductGid":"gid://shopify/Product/111","bumpaProductId":"abc123"},
        {"shopifyProductGid":"gid://shopify/Product/222"}
      ]'
```

Response: `{ "batchId": "...", "queued": 3 }`

Check progress:

```bash
curl http://localhost:3000/uploads/batch/<batchId>
```

Returns counts per status and the list of failed jobs with error messages.

## Platform notes

**Shopify** — uses the current GraphQL flow (`stagedUploadsCreate` →
upload bytes directly to the returned signed URL → `productCreateMedia`).
This is the supported path for video; the legacy REST
`/products/{id}/images.json` endpoint doesn't handle video at all and is
being phased out. You need a custom app Admin API token with
`write_products` and `write_files` scopes.

**Bumpa** — their publicly documented API surface is limited (a Postman
collection at docs.bumpa.io, not a full open reference), and merchant API
access is generally granted on request from their support team. I've built
`src/adapters/bumpaAdapter.js` as a correct-shaped scaffold (auth, multipart
upload, single responsibility so retries work cleanly) but **the exact
endpoint path and field names are marked TODO** — get those confirmed from
Bumpa support before relying on this in production. Nothing else in the
pipeline needs to change once you fill those in.

## Shipping (ShipBubble) — rate shopping & tracking

Separate concern from the media pipeline, mounted at `/shipping`. Flow:

1. **Validate sender + receiver addresses** (once each — cache the sender's
   address_code since it's usually your fixed warehouse):

   ```bash
   curl -X POST http://localhost:3000/shipping/addresses/validate \
     -H "Content-Type: application/json" \
     -d '{"name":"Jane Doe","email":"jane@example.com","phone":"+2348012345678","address":"1 Admiralty Way, Lekki Phase 1, Lagos"}'
   ```

   Returns an `address_code`.

2. **Get rates** using both address codes:

   ```bash
   curl -X POST http://localhost:3000/shipping/rates \
     -H "Content-Type: application/json" \
     -d '{
       "sender_address_code": 18266419,
       "reciever_address_code": 32235981,
       "pickup_date": "2026-08-05",
       "category_id": 1,
       "package_items": [{"name":"T-shirt","description":"Cotton tee","unit_weight":"0.3","unit_amount":"5000","quantity":"1"}],
       "package_dimension": {"length":20,"width":15,"height":5}
     }'
   ```

   Returns a list of courier rates plus a `request_token` (valid 7 days) —
   show these to the customer at checkout and let them pick one.

3. **Create the shipment** with the chosen courier:

   ```bash
   curl -X POST http://localhost:3000/shipping/shipments \
     -H "Content-Type: application/json" \
     -d '{"request_token":"...","service_code":"cora","courier_id":"cora"}'
   ```

   Returns `order_id` and a `tracking_url`.

4. **Track**:
   - `GET /shipping/shipments?page=1` — paginated list of all shipments with
     current status/events (for a dashboard).
   - `GET /shipping/shipments/:orderId` — looks up one shipment by order_id.

Note: `reciever_address_code` (misspelled) is ShipBubble's actual field name,
not a typo on my end — kept as-is to match their API exactly.

Auth uses a Bearer token (`SHIPBUBBLE_API_KEY` in `.env`) — sandbox keys are
prefixed `sb_sandbox_`, live keys `sb_prod_`. Get one from your ShipBubble
dashboard.



- Swap SQLite for Postgres by replacing `src/db/db.js` — the rest of the app
  only calls the exported functions, not the driver directly.
- Add more platforms by writing a new adapter with an `uploadMedia()` method
  and a new queue/worker pair.
- For truly huge batches (tens of thousands+), consider pointing `multer` at
  S3 storage instead of local disk, and having workers stream from S3.
