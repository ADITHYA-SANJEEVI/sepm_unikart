alter table public.profiles
  add column if not exists notification_preferences jsonb not null default
    '{"buying": true, "selling": true, "safety": true, "system": true, "savedSearchAlerts": true}'::jsonb;
