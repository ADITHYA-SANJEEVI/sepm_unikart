create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text unique,
  email text not null unique,
  full_name text not null,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  campus_id text not null default 'srm-ktr',
  is_verified boolean not null default false,
  avatar_url text,
  bio text,
  response_reliability text not null default 'new' check (response_reliability in ('high', 'medium', 'new')),
  profile_completeness integer not null default 35,
  trust_badges jsonb not null default '[]'::jsonb,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  price numeric(10,2) not null default 0,
  currency text not null default 'INR',
  category text not null,
  condition text not null,
  status text not null default 'active',
  mode text not null default 'sale' check (mode in ('sale', 'rent', 'bundle')),
  negotiable boolean not null default false,
  fulfillment_modes jsonb not null default '[]'::jsonb,
  area text not null,
  campus_id text not null default 'srm-ktr',
  image_urls jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  rent_details jsonb,
  bundle_details jsonb,
  trust_score integer not null default 40,
  completeness_score integer not null default 45,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, listing_id)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'checked_out', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  unique (cart_id, listing_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_profile_id, seller_profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_schedules (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_mode text not null,
  proposed_time timestamptz not null,
  confirmed_time timestamptz,
  status text not null default 'requested',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  severity text not null default 'low',
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  admin_profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_profile_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_profile_id, blocked_profile_id)
);

create table if not exists public.ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_type text not null,
  subject_type text not null,
  subject_id text not null,
  source text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  filter_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.recently_viewed (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (profile_id, listing_id)
);
