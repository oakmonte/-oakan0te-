---
name: platform-import-contract
description: The contract for bringing external catalogue data into Oakmonte — Shopify, Bumpa, Instagram, and CSV. Covers the import_jobs lifecycle, idempotency via source_platform + external_handle, how a foreign product maps onto Oakmonte's canonical tables, partial-failure handling without transactions, and where credentials live. Use when building or changing an importer, an api.* connect/callback route, the import worker, CSV ingestion, re-sync or reconciliation logic, or when deciding what a half-imported product should look like.
---

# Platform import contract

Importers are the highest-risk writers in the system: they run unattended, at volume, against tables
with no transactions and (for `products` / `product_variants`) no RLS. A bug here doesn't show up as a
crash — it shows up as a seller's catalogue quietly containing wrong data.

**Read the `canonical-product-schema` skill alongside this one.** That skill defines the target shape;
this one defines how foreign data gets there.

## Status: partially built

What exists today: the `import_jobs` and `ig_posts` / `ig_post_files` tables, `store_credentials`, the
`api.shopify.install` / `api.shopify.callback` / `api.bumpa.connect` / `api.shipbubble.ping` routes,
and the newcomer UI at `store.products_.newcomer.tsx` that offers the entry points.

What doesn't: any importer that actually writes products. The mapping below is therefore the contract
to build *to*, derived from the destination schema — not a description of running code. Where this
skill states a rule that no code enforces yet, it's a decision to honour, and if you're about to
contradict one, that's worth raising rather than quietly diverging.

The import worker lives in a **separate repo** (`oakmonte-import-worker`), as does the backend
(`oakmonte-backend`). Neither sees this repo's `AGENTS.md`. Keep a copy of this skill and
`canonical-product-schema` in those repos — that's the only mechanism carrying the contract across the
boundary.

## Idempotency

Imports get retried, re-run, and re-triggered by webhooks. Every write path must be safe to run twice.

The key is **`(store_id, source_platform, external_handle)`**:

- `source_platform` — `'shopify'` | `'bumpa'` | `'instagram'` | `'csv'`. The manual form writes
  `'manual'`; never reuse that for imported rows.
- `external_handle` — the source system's own identifier for the product. Shopify product id, Bumpa
  product id, IG media id. Store it verbatim; don't slugify it, don't prefix it.

Match on that triple before inserting. A second run of the same import must update the existing
product, not create a twin. `handle` is Oakmonte's own slug and is **not** an identity key — two
different Shopify products can slugify to the same handle.

There is no unique constraint enforcing this yet. Until there is, the check is the importer's
responsibility, and a concurrent double-run can still produce duplicates. If you're adding one, a
partial unique index on `(store_id, source_platform, external_handle) where external_handle is not
null` is the shape that fits.

## Mapping foreign products onto the canonical tables

| Source concept | Oakmonte destination |
|---|---|
| product title, description, brand | `products.title`, `description_long` / `description_short`, `brand` |
| product id / handle in source | `products.external_handle` (+ `source_platform`) |
| category / product type | `products.product_type` (free text) — `category_id` needs the category tree, see below |
| option axes ("Size", "Color") | `product_options` + `product_option_values` **and** the flat `option1_*`…`option3_*` columns |
| each purchasable combination | one `product_variants` row + its `product_variant_options` links |
| price, compare-at, cost, stock, SKU, barcode, weight | `product_variants` (never on `products` — there is no product-level price) |
| images | `product_variants.main_image_url` / `additional_image_urls` |

Two things importers get wrong, both silent:

**Write both option representations.** The dual normalized/flat storage is a live expand/contract
window. Filling only `option1_*` produces variants invisible to normalized queries; filling only the
join table produces variants invisible to everything still reading the flat columns. The
`canonical-product-schema` skill has the exact insert order.

**More than three options is a real case.** The flat columns stop at three. Shopify allows three, but
CSV and Bumpa data can carry more. Truncating silently loses purchasable combinations — surface it as a
job error instead, or record the extra options normalized-only and note the decision.

## Completeness, not rejection

An import that lands a product with a title and an image but no price is normal — that's the whole
reason `products.is_complete` exists. Don't reject such rows and don't invent placeholder prices.

- `is_complete: false` — missing anything required to list (price, at least one variant, category).
- `status: 'draft'` — imported products start here regardless. `'active'` is a seller decision, never
  an importer's.

Those two are independent. A seller looking at the products list needs to be able to tell "I haven't
published this yet" from "this can't be published yet", and collapsing them destroys that.

Instagram is the extreme case: `ig_posts` / `ig_post_files` hold captions and media with no commerce
fields at all. Treat an IG import as seeding a draft the seller finishes, not as producing a listing.

## The import_jobs lifecycle

One row per import run. Columns: `store_id`, `platform`, `status` (default `'pending'`), `file_path`
(for CSV uploads), `error`, `created_at`, `updated_at`.

`status` is free text with no check constraint, so the vocabulary is a convention the writers have to
agree on. Use: `pending` → `running` → `succeeded` | `failed` | `partial`.

`partial` matters because of the no-transaction problem below — a run that imported 480 of 500 products
is neither a success nor a failure, and flattening it to one of those loses the information a seller
needs. Put a human-readable summary in `error` for `failed` and `partial` alike; the column name says
error but it's the only free-text field on the row.

Always write a terminal status. A job stuck in `running` because the worker died is indistinguishable
from one still in progress, and there's no heartbeat column to tell them apart.

## Partial failure

There are no transactions — this is PostgREST, not a stored procedure. The five-step insert chain for
one product can fail at step 4 and leave options and values orphaned.

For a single manual product the app just surfaces the error. For a bulk import that's not enough:
orphans accumulate across hundreds of products and nothing cleans them up.

Import products **one at a time, committing each fully before starting the next**, and on failure
delete the partial product by id — `product_options`, `product_variants` and their children cascade
from `products` via `on delete cascade`, so removing the product row is sufficient cleanup. Then record
the failure against the job and continue. A batch that inserts all products' options first and all
variants second is faster and much worse: one failure strands every product in the batch.

If per-product volume makes that too slow, the answer is an RPC that wraps the sequence server-side,
not a bigger batch.

## Credentials

`store_credentials` (keyed by `store_id`, RLS enabled) holds `shopify_access_token`,
`shopify_shop_domain`, `shopify_scopes`, `bumpa_api_key` and their `*_connected_at` timestamps.

Note that `stores` **also** has `shopify_shop_domain`, `shopify_access_token`, `shopify_connected_at`
and `shopify_scopes` columns, plus `bumpa_store_id`. That duplication is not intentional design — it's
two connect flows written at different times. `store_credentials` is the right home (it's the one with
RLS on, and it keeps tokens out of the row the storefront reads). When touching either connect path,
prefer `store_credentials` and treat the `stores` columns as legacy; don't add new credential columns
to `stores`.

Tokens are read server-side only. Any handler touching them needs `supabaseAdmin` via dynamic import —
see the `supabase-data-access` skill for why the import has to be dynamic.

## Categories

`products.category_id` points at the category tree, and `src/lib/categories.ts` has a semantic worth
knowing before mapping into it: on a `CategoryNode`, omitting `children` means a true leaf, while
`children: []` means "has children, we just haven't filled them in". They are not interchangeable, and
an importer resolving a foreign category string to a node must not treat the second as the first.

Where a source category doesn't map cleanly, leave `category_id` null and put the source's own string
in `product_type` rather than guessing. A wrong category is harder to find and fix later than a missing
one.
