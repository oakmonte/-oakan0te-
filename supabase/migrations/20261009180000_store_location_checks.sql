-- Pickup locations: checked against Shipbubble when saved, plus a free-text
-- note for riders.
--
-- verified_address: Shipbubble's own formatted version of the address, shown
--   back to the seller so they can see what couriers will be sent to. Null =
--   never checked (older rows, or saved while Shipbubble was unreachable).
-- address_verified_at: when that check passed.
-- notes: directions riders need that don't belong in an address -- "blue gate
--   opposite the church, call on arrival".

alter table public.store_locations add column if not exists verified_address text;
alter table public.store_locations add column if not exists address_verified_at timestamptz;
alter table public.store_locations add column if not exists notes text;

alter table public.store_locations drop constraint if exists store_locations_notes_length;
alter table public.store_locations add constraint store_locations_notes_length
  check (notes is null or char_length(notes) <= 500);
