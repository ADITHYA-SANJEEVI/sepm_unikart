create table if not exists public.transaction_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  previous_offer_id uuid references public.transaction_offers(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  kind text not null default 'offer' check (kind in ('offer', 'counter_offer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'superseded')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_holds (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'released', 'converted', 'expired')),
  note text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transaction_offers_listing_status_idx
  on public.transaction_offers (listing_id, status, created_at desc);

create index if not exists transaction_offers_conversation_created_idx
  on public.transaction_offers (conversation_id, created_at desc);

create index if not exists transaction_offers_participants_idx
  on public.transaction_offers (buyer_profile_id, seller_profile_id, created_at desc);

create index if not exists listing_holds_listing_expires_idx
  on public.listing_holds (listing_id, expires_at desc);

create index if not exists listing_holds_participants_idx
  on public.listing_holds (buyer_profile_id, seller_profile_id, created_at desc);

create unique index if not exists listing_holds_one_active_per_listing_idx
  on public.listing_holds (listing_id)
  where status = 'active';

alter table public.transaction_offers enable row level security;
alter table public.listing_holds enable row level security;

drop policy if exists transaction_offers_manage_participants on public.transaction_offers;
create policy transaction_offers_manage_participants on public.transaction_offers
for all to authenticated
using (
  buyer_profile_id = public.current_profile_id()
  or seller_profile_id = public.current_profile_id()
  or public.is_admin()
)
with check (
  buyer_profile_id = public.current_profile_id()
  or seller_profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists listing_holds_manage_participants on public.listing_holds;
create policy listing_holds_manage_participants on public.listing_holds
for all to authenticated
using (
  buyer_profile_id = public.current_profile_id()
  or seller_profile_id = public.current_profile_id()
  or public.is_admin()
)
with check (
  buyer_profile_id = public.current_profile_id()
  or seller_profile_id = public.current_profile_id()
  or public.is_admin()
);
