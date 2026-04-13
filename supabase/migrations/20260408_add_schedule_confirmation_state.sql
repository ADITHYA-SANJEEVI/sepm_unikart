alter table public.delivery_schedules
add column if not exists proposer_profile_id uuid references public.profiles(id) on delete cascade,
add column if not exists buyer_confirmed_at timestamptz,
add column if not exists seller_confirmed_at timestamptz;

update public.delivery_schedules
set proposer_profile_id = coalesce(proposer_profile_id, buyer_profile_id)
where proposer_profile_id is null;

update public.delivery_schedules
set status = case
  when status = 'requested' then 'proposed'
  when status = 'accepted' then 'confirmed'
  else status
end
where status in ('requested', 'accepted');

alter table public.delivery_schedules
alter column proposer_profile_id set not null;

alter table public.delivery_schedules
alter column status set default 'proposed';

create index if not exists delivery_schedules_proposer_profile_id_idx
on public.delivery_schedules (proposer_profile_id);
