alter table public.saved_filters
  add column if not exists alert_enabled boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_triggered_at timestamptz;

create index if not exists saved_filters_profile_alert_idx
  on public.saved_filters (profile_id, alert_enabled, updated_at desc);

alter table public.user_notifications
  add column if not exists category text not null default 'system' check (
    category in ('buying', 'selling', 'safety', 'system', 'admin')
  ),
  add column if not exists priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high')
  ),
  add column if not exists action_label text,
  add column if not exists action_href text,
  add column if not exists dismissed_at timestamptz;

create index if not exists user_notifications_active_idx
  on public.user_notifications (profile_id, dismissed_at, read_at, created_at desc);
