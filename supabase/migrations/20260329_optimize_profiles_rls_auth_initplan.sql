drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (auth_user_id = (select auth.uid())::text or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (auth_user_id = (select auth.uid())::text or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update to authenticated
using (auth_user_id = (select auth.uid())::text or public.is_admin())
with check (auth_user_id = (select auth.uid())::text or public.is_admin());
