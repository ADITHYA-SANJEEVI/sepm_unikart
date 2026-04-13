insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-media',
  'listing-media',
  true,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.listing_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid null references public.listings(id) on delete cascade,
  bucket_id text not null default 'listing-media',
  object_path text not null unique,
  public_url text not null,
  media_kind text not null check (media_kind in ('image', 'video')),
  mime_type text not null,
  file_size_bytes bigint null,
  width integer null,
  height integer null,
  duration_seconds numeric(10,2) null,
  sort_order integer not null default 0,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded', 'ready', 'failed')),
  original_filename text null,
  checksum text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listing_media_assets enable row level security;

create index if not exists idx_listing_media_assets_listing_order
  on public.listing_media_assets (listing_id, sort_order, created_at desc);

create index if not exists idx_listing_media_assets_owner_created
  on public.listing_media_assets (owner_profile_id, created_at desc);

create index if not exists idx_listing_media_assets_status_created
  on public.listing_media_assets (upload_status, created_at desc);

create table if not exists public.ai_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  model text null,
  status text not null check (status in ('success', 'fallback', 'provider_error', 'timeout', 'parse_error', 'config_bypass')),
  used_fallback boolean not null default false,
  http_status integer null,
  latency_ms integer null,
  subject_type text not null,
  subject_id text not null,
  error_message text null,
  request_meta jsonb not null default '{}'::jsonb,
  response_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_provider_events enable row level security;

create index if not exists idx_ai_provider_events_created
  on public.ai_provider_events (created_at desc);

create index if not exists idx_ai_provider_events_provider_operation
  on public.ai_provider_events (provider, operation, created_at desc);

create index if not exists idx_ai_provider_events_status
  on public.ai_provider_events (status, created_at desc);

create index if not exists idx_favorites_listing_created
  on public.favorites (listing_id, created_at desc);

create index if not exists idx_conversations_listing_created
  on public.conversations (listing_id, created_at desc);

create index if not exists idx_listing_holds_listing_created
  on public.listing_holds (listing_id, created_at desc);

create index if not exists idx_delivery_schedules_listing_created
  on public.delivery_schedules (listing_id, created_at desc);

create index if not exists idx_recently_viewed_profile_viewed
  on public.recently_viewed (profile_id, viewed_at desc);

create index if not exists idx_user_notifications_profile_created
  on public.user_notifications (profile_id, created_at desc);

create or replace view public.platform_daily_metrics_v1 as
with unified as (
  select created_at::date as day, 1::bigint as listings_created, 0::bigint as notifications_created, 0::bigint as reports_created, 0::bigint as ai_artifacts_created, 0::bigint as compare_items_added, 0::bigint as media_assets_created
  from public.listings
  union all
  select created_at::date as day, 0, 1, 0, 0, 0, 0
  from public.user_notifications
  union all
  select created_at::date as day, 0, 0, 1, 0, 0, 0
  from public.reports
  union all
  select created_at::date as day, 0, 0, 0, 1, 0, 0
  from public.ai_artifacts
  union all
  select created_at::date as day, 0, 0, 0, 0, 1, 0
  from public.compare_queue_items
  union all
  select created_at::date as day, 0, 0, 0, 0, 0, 1
  from public.listing_media_assets
)
select
  day,
  sum(listings_created)::bigint as listings_created,
  sum(notifications_created)::bigint as notifications_created,
  sum(reports_created)::bigint as reports_created,
  sum(ai_artifacts_created)::bigint as ai_artifacts_created,
  sum(compare_items_added)::bigint as compare_items_added,
  sum(media_assets_created)::bigint as media_assets_created
from unified
group by day
order by day desc;

create or replace view public.seller_daily_activity_v1 as
with unified as (
  select l.seller_profile_id, l.created_at::date as day, 1::bigint as listings_created, 0::bigint as favorites_added, 0::bigint as conversations_started, 0::bigint as holds_created, 0::bigint as schedules_created
  from public.listings l
  union all
  select l.seller_profile_id, f.created_at::date as day, 0, count(*)::bigint, 0, 0, 0
  from public.favorites f
  join public.listings l on l.id = f.listing_id
  group by l.seller_profile_id, f.created_at::date
  union all
  select l.seller_profile_id, c.created_at::date as day, 0, 0, count(*)::bigint, 0, 0
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  group by l.seller_profile_id, c.created_at::date
  union all
  select h.seller_profile_id, h.created_at::date as day, 0, 0, 0, count(*)::bigint, 0
  from public.listing_holds h
  group by h.seller_profile_id, h.created_at::date
  union all
  select s.seller_profile_id, s.created_at::date as day, 0, 0, 0, 0, count(*)::bigint
  from public.delivery_schedules s
  group by s.seller_profile_id, s.created_at::date
)
select
  seller_profile_id,
  day,
  sum(listings_created)::bigint as listings_created,
  sum(favorites_added)::bigint as favorites_added,
  sum(conversations_started)::bigint as conversations_started,
  sum(holds_created)::bigint as holds_created,
  sum(schedules_created)::bigint as schedules_created
from unified
group by seller_profile_id, day
order by day desc;

create or replace view public.buyer_daily_activity_v1 as
with unified as (
  select f.profile_id, f.created_at::date as day, count(*)::bigint as saved_listings, 0::bigint as compared_listings, 0::bigint as recently_viewed, 0::bigint as buying_notifications, 0::bigint as buyer_conversations, 0::bigint as buyer_schedules
  from public.favorites f
  group by f.profile_id, f.created_at::date
  union all
  select c.profile_id, c.created_at::date as day, 0, count(*)::bigint, 0, 0, 0, 0
  from public.compare_queue_items c
  group by c.profile_id, c.created_at::date
  union all
  select r.profile_id, r.viewed_at::date as day, 0, 0, count(*)::bigint, 0, 0, 0
  from public.recently_viewed r
  group by r.profile_id, r.viewed_at::date
  union all
  select n.profile_id, n.created_at::date as day, 0, 0, 0, count(*)::bigint, 0, 0
  from public.user_notifications n
  where n.category = 'buying'
  group by n.profile_id, n.created_at::date
  union all
  select c.buyer_profile_id as profile_id, c.created_at::date as day, 0, 0, 0, 0, count(*)::bigint, 0
  from public.conversations c
  group by c.buyer_profile_id, c.created_at::date
  union all
  select s.buyer_profile_id as profile_id, s.created_at::date as day, 0, 0, 0, 0, 0, count(*)::bigint
  from public.delivery_schedules s
  group by s.buyer_profile_id, s.created_at::date
)
select
  profile_id,
  day,
  sum(saved_listings)::bigint as saved_listings,
  sum(compared_listings)::bigint as compared_listings,
  sum(recently_viewed)::bigint as recently_viewed,
  sum(buying_notifications)::bigint as buying_notifications,
  sum(buyer_conversations)::bigint as buyer_conversations,
  sum(buyer_schedules)::bigint as buyer_schedules
from unified
group by profile_id, day
order by day desc;

create or replace view public.ai_provider_daily_v1 as
select
  created_at::date as day,
  provider,
  operation,
  coalesce(model, 'unknown') as model,
  count(*)::bigint as total_requests,
  count(*) filter (where status = 'success')::bigint as success_count,
  count(*) filter (where used_fallback = true)::bigint as fallback_count,
  count(*) filter (where status = 'provider_error')::bigint as provider_error_count,
  count(*) filter (where status = 'timeout')::bigint as timeout_count,
  count(*) filter (where status = 'parse_error')::bigint as parse_error_count,
  round(avg(latency_ms)::numeric, 2) as avg_latency_ms
from public.ai_provider_events
group by created_at::date, provider, operation, coalesce(model, 'unknown')
order by day desc, provider, operation;
