-- This project auto-enables RLS on newly created tables (see the
-- rls_auto_enable security-definer function, and the identical fix already
-- applied for collections/product_collections in disable_rls_collections).
-- tags/product_tags are written directly from the browser via the same
-- hardcoded DEV_STORE_ID hack as collections, so they need the same
-- disabled-RLS treatment until real store scoping replaces that hack.
alter table public.tags disable row level security;
alter table public.product_tags disable row level security;
