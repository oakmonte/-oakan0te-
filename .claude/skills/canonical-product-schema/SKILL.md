---
name: canonical-product-schema
description: Oakmonte's canonical product data model — products, product_variants, product_options / product_option_values / product_variant_options, and the deliberate dual (normalized + flat option1_*) representation of variant options. Use whenever writing, reading, importing, or migrating product data: manual listing forms, Shopify/Bumpa/Instagram importers, variant matrix work, CSV ingestion, seed scripts, or any migration touching products or variants. Also use when deciding where a new product-level field belongs.
---

# Canonical product schema

Product data spans six tables. The trap that costs the most time: **variant options are stored twice,
on purpose**, and a writer that populates only one representation produces data that looks fine in
the form it was created from and is broken everywhere else.

## Table map

```
stores
  └── products                     store_id, handle, title, status, is_complete, source_platform
        ├── product_options        name, position                     (normalized: "Size")
        │     └── product_option_values  value, position              (normalized: "M")
        └── product_variants       price, stock_qty, sku, option1_name/value … option3_name/value
              └── product_variant_options  (variant_id, option_id, value_id)   ← join table
```

`product_variant_options` has composite PK `(variant_id, option_id)` — one row per variant per option.

## The dual representation

`product_variants` carries flat `option1_name` / `option1_value` … `option3_name` / `option3_value`
**and** the same information is expressed normalized through the join table. Both are written on every
variant insert.

This is a transitional contract, not redundancy someone forgot to clean up: the flat columns keep
existing readers working until the contract migration drops them (see the comment at the
`variantsPayload` construction in `src/routes/store.products_.new.tsx`). Consequences:

- **Writing variants means writing both.** Populate the flat columns *and* insert the
  `product_variant_options` links. An importer that only fills `option1_*` creates variants invisible
  to anything querying through the join table, and vice versa.
- The flat columns cap out at **3 options**. The normalized side has no such limit. If a source
  platform sends a 4th option, that's a decision to surface — don't silently truncate.
- **Reading**: prefer the normalized path for anything new, so it survives the migration.

## Write order

Inserts are sequential and there is **no transaction** — this is the PostgREST client, not a stored
procedure. Foreign keys force this order:

1. `products` → returns the product id
2. `product_options`
3. `product_option_values`
4. `product_variants`
5. `product_variant_options`

Mint UUIDs client-side with `crypto.randomUUID()` before inserting, so rows can be cross-linked in one
pass without round-tripping for generated ids or trusting insert order to come back intact. That's the
pattern already in `store.products_.new.tsx`; match it.

Because there's no transaction, a failure at step 4 leaves orphaned options behind. Existing code
aborts and surfaces `${table}: ${message}`. For bulk importers, where partial state accumulates across
many products, prefer a cleanup path or an RPC that wraps the sequence — don't assume the manual-form
approach scales to a 500-product import.

## Draft vs Incomplete — two independent axes

`products` has both, and they answer different questions:

- **`status`** (text, default `'draft'`) — seller intent. Currently `'draft'` or `'active'`. Governs
  whether buyers see it.
- **`is_complete`** (boolean, default `false`) — whether the record has enough data to be listable.
  The manual form sets `true` because its required fields are enforced in the UI.

Importers are the reason `is_complete` exists: an Instagram or Shopify import can produce a product
with a title and image but no price, category, or variants. That's `is_complete: false`, and it should
stay `status: 'draft'` — not because the seller chose draft, but because it isn't listable yet. Never
infer one field from the other.

`source_platform` records provenance (`'manual'`, and platform names for importers); `external_handle`
holds the source system's id for reconciliation on re-import.

## Where new fields go

- Varies per purchasable unit (price, stock, SKU, material, images) → `product_variants`.
  Single-variant products still get a variant row; there is no product-level price.
- Same across all variants (title, description, category, brand) → `products`.
- A selectable axis buyers choose from → `product_options` + `product_option_values`, never a new
  column.

## Size measurements — read before touching cm/in

Size values are currently plain strings (`"91 cm"`) in `product_option_values.value`. The universal
size chart is unbuilt and needs a schema decision first — where per-value cm/inch numbers live (on the
option, on `product_variants`, or a separate size-chart table keyed to buyer body measurements). Don't
add local-only UI state for this; it has to persist. Root `CLAUDE.md` tracks this as a pre-launch item.

## Types

The client is typed — `createClient<Database>` with `Database` from
`@/lib/integrations/my-supabase/types`. Table and column names in this skill are compiler-checked, so
prefer generated types over hand-written row shapes:

```ts
import type { Tables, TablesInsert } from "@/lib/integrations/my-supabase/types";
type Variant = Tables<"product_variants">;
type NewProduct = TablesInsert<"products">;
```

Regenerate them after any schema change (`mcp__supabase__generate_typescript_types`) — a stale snapshot
type-checks against a schema that no longer exists.

## RLS status (as of 2026-08-18)

`stores`, `products`, and `product_variants` have **RLS disabled**. The other tables here have it
enabled. Don't assume the browser client is row-scoped on those three — it isn't. Confirm current
state with `mcp__supabase__get_advisors`, and see the `supabase-data-access` skill for why enabling it
is coupled to replacing `DEV_STORE_ID`.
