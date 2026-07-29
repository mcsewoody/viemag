-- VIEMAG — make "at least one owner always exists" a database invariant.
--
-- manage-admins already refuses to let you delete or demote yourself, and
-- refuses to remove the last owner. But those are application checks in a
-- function that someone will edit later, and the CASCADE from auth.users means
-- a staff account can also disappear from outside that function entirely
-- (Supabase dashboard, CLI, a stray SQL statement). Losing the last owner is
-- unrecoverable from /admin — the only way back would be hand-editing the
-- database — so the rule belongs in Postgres.
--
-- Statement-level, so it fires once per statement rather than per row, and it
-- correctly allows a multi-row statement that demotes one owner while promoting
-- another. It is NOT a serialization guarantee: two concurrent transactions each
-- demoting a different owner would both see an owner in their own snapshot. The
-- self-guard in manage-admins is what actually prevents that in practice; this
-- is the backstop for everything that bypasses the function.

create or replace function public.guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.admin_users where role = 'owner') then
    raise exception 'at least one owner must remain in admin_users'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create trigger admin_users_keep_one_owner
  after update or delete on public.admin_users
  for each statement execute function public.guard_last_owner();
