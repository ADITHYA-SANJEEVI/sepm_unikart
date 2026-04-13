create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()::text
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()::text
      and role = 'admin'
  );
$$;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.favorites enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.delivery_schedules enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.blocked_users enable row level security;
alter table public.ai_artifacts enable row level security;
alter table public.saved_filters enable row level security;
alter table public.recently_viewed enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (auth_user_id = auth.uid()::text or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (auth_user_id = auth.uid()::text or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update to authenticated
using (auth_user_id = auth.uid()::text or public.is_admin())
with check (auth_user_id = auth.uid()::text or public.is_admin());

drop policy if exists listings_select_marketplace_or_owner on public.listings;
create policy listings_select_marketplace_or_owner on public.listings
for select to authenticated
using (
  status = 'active'
  or seller_profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists listings_insert_own_or_admin on public.listings;
create policy listings_insert_own_or_admin on public.listings
for insert to authenticated
with check (
  seller_profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists listings_update_own_or_admin on public.listings;
create policy listings_update_own_or_admin on public.listings
for update to authenticated
using (
  seller_profile_id = public.current_profile_id()
  or public.is_admin()
)
with check (
  seller_profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists listings_delete_own_or_admin on public.listings;
create policy listings_delete_own_or_admin on public.listings
for delete to authenticated
using (
  seller_profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists favorites_manage_own on public.favorites;
create policy favorites_manage_own on public.favorites
for all to authenticated
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists carts_manage_own on public.carts;
create policy carts_manage_own on public.carts
for all to authenticated
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists cart_items_manage_own on public.cart_items;
create policy cart_items_manage_own on public.cart_items
for all to authenticated
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and (c.profile_id = public.current_profile_id() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and (c.profile_id = public.current_profile_id() or public.is_admin())
  )
);

drop policy if exists conversations_manage_participants on public.conversations;
create policy conversations_manage_participants on public.conversations
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

drop policy if exists messages_manage_participants on public.messages;
create policy messages_manage_participants on public.messages
for all to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_profile_id = public.current_profile_id()
        or c.seller_profile_id = public.current_profile_id()
        or public.is_admin()
      )
  )
)
with check (
  sender_profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists delivery_schedules_manage_participants on public.delivery_schedules;
create policy delivery_schedules_manage_participants on public.delivery_schedules
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

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
for insert to authenticated
with check (reporter_profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists reports_select_own_or_admin on public.reports;
create policy reports_select_own_or_admin on public.reports
for select to authenticated
using (reporter_profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists moderation_actions_admin_only on public.moderation_actions;
create policy moderation_actions_admin_only on public.moderation_actions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists blocked_users_manage_own on public.blocked_users;
create policy blocked_users_manage_own on public.blocked_users
for all to authenticated
using (blocker_profile_id = public.current_profile_id() or public.is_admin())
with check (blocker_profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists ai_artifacts_admin_only on public.ai_artifacts;
create policy ai_artifacts_admin_only on public.ai_artifacts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists saved_filters_manage_own on public.saved_filters;
create policy saved_filters_manage_own on public.saved_filters
for all to authenticated
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists recently_viewed_manage_own on public.recently_viewed;
create policy recently_viewed_manage_own on public.recently_viewed
for all to authenticated
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

create index if not exists listings_seller_profile_id_idx on public.listings (seller_profile_id);
create index if not exists favorites_listing_id_idx on public.favorites (listing_id);
create index if not exists carts_profile_id_idx on public.carts (profile_id);
create index if not exists cart_items_listing_id_idx on public.cart_items (listing_id);
create index if not exists conversations_buyer_profile_id_idx on public.conversations (buyer_profile_id);
create index if not exists conversations_seller_profile_id_idx on public.conversations (seller_profile_id);
create index if not exists delivery_schedules_buyer_profile_id_idx on public.delivery_schedules (buyer_profile_id);
create index if not exists delivery_schedules_listing_id_idx on public.delivery_schedules (listing_id);
create index if not exists delivery_schedules_seller_profile_id_idx on public.delivery_schedules (seller_profile_id);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_sender_profile_id_idx on public.messages (sender_profile_id);
create index if not exists moderation_actions_admin_profile_id_idx on public.moderation_actions (admin_profile_id);
create index if not exists moderation_actions_report_id_idx on public.moderation_actions (report_id);
create index if not exists reports_reporter_profile_id_idx on public.reports (reporter_profile_id);
create index if not exists saved_filters_profile_id_idx on public.saved_filters (profile_id);
create index if not exists blocked_users_blocked_profile_id_idx on public.blocked_users (blocked_profile_id);
create index if not exists recently_viewed_listing_id_idx on public.recently_viewed (listing_id);

create index if not exists listings_marketplace_idx on public.listings (status, campus_id, category, mode, created_at desc);
create index if not exists listings_seller_status_idx on public.listings (seller_profile_id, status, updated_at desc);
create index if not exists favorites_profile_created_idx on public.favorites (profile_id, created_at desc);
create index if not exists reports_status_severity_idx on public.reports (status, severity, created_at desc);
create index if not exists delivery_schedules_status_idx on public.delivery_schedules (status, proposed_time);
