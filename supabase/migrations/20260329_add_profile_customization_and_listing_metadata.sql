alter table public.profiles
  add column if not exists contact_number text,
  add column if not exists hostel text,
  add column if not exists department text,
  add column if not exists setup_completed boolean not null default false;

alter table public.listings
  add column if not exists listing_metadata jsonb not null default '{}'::jsonb;
