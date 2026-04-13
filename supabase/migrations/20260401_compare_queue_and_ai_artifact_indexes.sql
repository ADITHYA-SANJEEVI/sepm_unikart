create table if not exists public.compare_queue_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, listing_id)
);

alter table public.compare_queue_items enable row level security;

drop policy if exists compare_queue_items_manage_own on public.compare_queue_items;
create policy compare_queue_items_manage_own on public.compare_queue_items
for all to authenticated
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

create index if not exists compare_queue_items_profile_created_idx
  on public.compare_queue_items (profile_id, created_at desc);

create index if not exists compare_queue_items_listing_idx
  on public.compare_queue_items (listing_id);

create index if not exists ai_artifacts_created_idx
  on public.ai_artifacts (created_at desc);

create index if not exists ai_artifacts_subject_idx
  on public.ai_artifacts (subject_type, subject_id, created_at desc);

create index if not exists ai_artifacts_type_idx
  on public.ai_artifacts (artifact_type, created_at desc);
