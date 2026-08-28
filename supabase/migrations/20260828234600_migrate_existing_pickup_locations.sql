-- One-time backfill: carry each store's single pickup location (the old
-- stores.pickup_* columns) into the new store_locations table as its first
-- named location, so multi-location support doesn't lose what sellers
-- already saved. The old columns are left in place for now, unused --
-- dropping them is a separate, deliberate step.
insert into public.store_locations
  (store_id, name, address_line, address_line2, city, state, country, postal_code, lat, lng, created_at)
select
  id, 'Main location', pickup_address_line, pickup_address_line2, pickup_city, pickup_state,
  pickup_country, pickup_postal_code, pickup_lat, pickup_lng, coalesce(pickup_location_updated_at, now())
from public.stores
where pickup_city is not null and pickup_state is not null and pickup_country is not null;
