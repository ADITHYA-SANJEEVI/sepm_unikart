alter table public.listings
  add column if not exists inventory_count integer not null default 1;

update public.listings
set inventory_count = 1
where inventory_count is null;
