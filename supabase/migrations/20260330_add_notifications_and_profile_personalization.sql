alter table public.profiles
  add column if not exists seller_headline text,
  add column if not exists preferred_meetup_spot text,
  add column if not exists favorite_categories jsonb not null default '[]'::jsonb;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (
    type in (
      'listing_sold',
      'listing_updated',
      'listing_deleted',
      'hold_requested',
      'offer_received',
      'system'
    )
  ),
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_profile_created_idx
  on public.user_notifications (profile_id, created_at desc);

create index if not exists user_notifications_unread_idx
  on public.user_notifications (profile_id, read_at, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_manage_own on public.user_notifications;
create policy user_notifications_manage_own on public.user_notifications
for all to authenticated
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());
