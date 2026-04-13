alter table public.delivery_schedules
add column if not exists meetup_location jsonb;
