-- VIEMAG — staff account management
--
-- Until now the auth boundary was "signup is disabled in the dashboard", and
-- every RLS policy was `to authenticated using (true)`: any account that could
-- log in could edit anything, and adding or removing a colleague meant opening
-- the Supabase dashboard. This table gives /admin a roster it can render and a
-- role it can check, without ever handing the browser a service_role key.
--
-- Writes are deliberately NOT possible from a client. Every mutation goes
-- through the `manage-admins` Edge Function, which runs with service_role
-- (bypassing RLS) after verifying the caller is an authenticated owner.

create table public.admin_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'editor' check (role in ('owner', 'editor')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.admin_users is
  'Staff profile + role for each Supabase Auth user. Client-readable, service_role-writable only.';
comment on column public.admin_users.role is
  'owner = may add/remove/reset other staff accounts. editor = content only.';

create trigger admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

create index admin_users_role_idx on public.admin_users (role);

alter table public.admin_users enable row level security;

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated, so a bare `enable row level security` + one select policy
-- would still leave the write grants in place. Strip them explicitly.
revoke all on public.admin_users from anon;
revoke all on public.admin_users from authenticated;
grant select on public.admin_users to authenticated;

-- Staff may read the whole roster: /admin needs it to know the signed-in
-- user's own role, and a shared team list is not sensitive between colleagues.
-- No insert/update/delete policy exists, by design.
create policy admin_users_select on public.admin_users
  for select to authenticated using (true);

-- Keep the roster in step with auth.users no matter how the account was made
-- (Edge Function, Supabase dashboard, CLI). New accounts land as 'editor';
-- promotion is an explicit act.
create or replace function public.sync_admin_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.admin_users (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_admin_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_admin_user();

-- Backfill the accounts that already exist. The first account ever created is
-- the founding owner; anyone added since starts as an editor and can be
-- promoted from /admin. Written as a subquery rather than a hard-coded email so
-- this migration is safe to replay against a restored or local database.
insert into public.admin_users (user_id, email, role)
select u.id,
       coalesce(u.email, ''),
       case when u.id = (select id from auth.users order by created_at asc limit 1)
            then 'owner' else 'editor' end
from auth.users u
on conflict (user_id) do nothing;
