-- Sales OS v0.09 Phase 5: explicit team roles, approval-gated joins, and managed task assignment.
-- Additive migration for a v0.082 workspace. The atomic claim function is intentionally untouched.

begin;

alter table public.organizations
  add column if not exists open_join boolean not null default false;

alter table public.memberships
  add column if not exists status text not null default 'active',
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.memberships alter column joined_at drop not null;
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships drop constraint if exists memberships_status_check;

update public.memberships
set role = case role when 'admin' then 'manager' when 'member' then 'rep' else role end,
    status = 'active',
    approved_at = coalesce(approved_at, joined_at, now());

alter table public.memberships alter column role set default 'rep';
alter table public.memberships
  add constraint memberships_role_check check (role in ('owner', 'manager', 'rep')),
  add constraint memberships_status_check check (status in ('pending', 'active', 'rejected'));

create or replace function public.is_org_member(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id and m.user_id = p_user_id and m.status = 'active'
  );
$$;

create or replace function public.org_role(p_organization_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id and m.status = 'active'
  limit 1;
$$;

create or replace function public.shares_organization(p_first_user uuid, p_second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on b.organization_id = a.organization_id
    where a.user_id = p_first_user and b.user_id = p_second_user
      and a.status = 'active' and b.status = 'active'
  );
$$;

create or replace function public.protect_shared_record_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id <> old.organization_id then raise exception 'Organization cannot be changed'; end if;
  if tg_table_name = 'team_leads' and (to_jsonb(new) ->> 'lead_id') is distinct from (to_jsonb(old) ->> 'lead_id') then raise exception 'Lead identity cannot be changed'; end if;
  if tg_table_name = 'team_tasks' and (to_jsonb(new) ->> 'task_id') is distinct from (to_jsonb(old) ->> 'task_id') then raise exception 'Task identity cannot be changed'; end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if new.updated_at < old.updated_at then return old; end if;
  if (new.visibility, new.owner_user_id) is distinct from (old.visibility, old.owner_user_id)
    and old.created_by <> auth.uid()
    and public.org_role(old.organization_id, auth.uid()) not in ('owner', 'manager')
  then
    raise exception 'Only the creator, owner, or manager can change sharing scope' using errcode = '42501';
  end if;
  if tg_table_name = 'team_tasks'
    and new.owner_user_id is distinct from old.owner_user_id
    and new.owner_user_id is distinct from auth.uid()
    and public.org_role(old.organization_id, auth.uid()) not in ('owner', 'manager')
  then
    raise exception 'Only an owner or manager can assign work to another teammate' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop function if exists public.create_organization(text);
create function public.create_organization(p_name text)
returns table (id uuid, name text, invite_code text, role text, membership_status text, open_join boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then raise exception 'Team name must be 2 to 100 characters'; end if;
  insert into public.profiles (id, display_name)
  values (auth.uid(), coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''), split_part(coalesce(auth.jwt() ->> 'email', 'Sales operator'), '@', 1)))
  on conflict (id) do nothing;
  insert into public.organizations (name, created_by) values (v_name, auth.uid()) returning * into v_org;
  insert into public.memberships (organization_id, user_id, role, status, joined_at, approved_at, approved_by)
  values (v_org.id, auth.uid(), 'owner', 'active', now(), now(), auth.uid());
  return query select v_org.id, v_org.name, v_org.invite_code, 'owner'::text, 'active'::text, v_org.open_join;
end;
$$;

drop function if exists public.join_organization_by_code(text);
create function public.join_organization_by_code(p_invite_code text)
returns table (id uuid, name text, invite_code text, role text, membership_status text, open_join boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select o.* into v_org from public.organizations o where o.invite_code = upper(trim(coalesce(p_invite_code, '')));
  if v_org.id is null then raise exception 'Invite code not found'; end if;
  insert into public.profiles (id, display_name)
  values (auth.uid(), coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''), split_part(coalesce(auth.jwt() ->> 'email', 'Sales operator'), '@', 1)))
  on conflict (id) do nothing;
  insert into public.memberships (organization_id, user_id, role, status, joined_at, approved_at, approved_by)
  values (
    v_org.id, auth.uid(), 'rep',
    case when v_org.open_join then 'active' else 'pending' end,
    case when v_org.open_join then now() else null end,
    case when v_org.open_join then now() else null end,
    case when v_org.open_join then v_org.created_by else null end
  )
  on conflict (organization_id, user_id) do update
    set status = case when public.memberships.status = 'active' then 'active' when v_org.open_join then 'active' else 'pending' end,
        role = case when public.memberships.role = 'owner' then 'owner' else 'rep' end,
        requested_at = now(),
        joined_at = case when public.memberships.status = 'active' or v_org.open_join then coalesce(public.memberships.joined_at, now()) else null end,
        approved_at = case when public.memberships.status = 'active' or v_org.open_join then coalesce(public.memberships.approved_at, now()) else null end,
        approved_by = case when public.memberships.status = 'active' then public.memberships.approved_by when v_org.open_join then v_org.created_by else null end;
  return query
    select v_org.id, v_org.name, v_org.invite_code, m.role, m.status, v_org.open_join
    from public.memberships m
    where m.organization_id = v_org.id and m.user_id = auth.uid();
end;
$$;

create or replace function public.review_organization_membership(
  p_organization_id uuid, p_user_id uuid, p_approved boolean default true
)
returns table (user_id uuid, role text, status text, joined_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if public.org_role(p_organization_id, auth.uid()) not in ('owner', 'manager') then raise exception 'Owner or manager access required' using errcode = '42501'; end if;
  select * into v_target from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id for update;
  if v_target.user_id is null then raise exception 'Membership request not found'; end if;
  if v_target.role = 'owner' then raise exception 'The owner membership cannot be reviewed'; end if;
  update public.memberships m
  set status = case when p_approved then 'active' else 'rejected' end,
      role = case when p_approved then 'rep' else m.role end,
      joined_at = case when p_approved then coalesce(m.joined_at, now()) else null end,
      approved_at = now(), approved_by = auth.uid()
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
  return query select m.user_id, m.role, m.status, m.joined_at from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
end;
$$;

create or replace function public.set_organization_member_role(
  p_organization_id uuid, p_user_id uuid, p_role text
)
returns table (user_id uuid, role text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_role text := lower(trim(coalesce(p_role, '')));
  v_target public.memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_actor_role := public.org_role(p_organization_id, auth.uid());
  if v_actor_role <> 'owner' then raise exception 'Owner access required to change team roles' using errcode = '42501'; end if;
  if v_role not in ('manager', 'rep') then raise exception 'Role must be manager or rep'; end if;
  select * into v_target from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id and m.status = 'active' for update;
  if v_target.user_id is null then raise exception 'Active membership not found'; end if;
  if v_target.role = 'owner' then raise exception 'The owner role cannot be changed'; end if;
  update public.memberships m set role = v_role
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
  return query select m.user_id, m.role, m.status from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
end;
$$;

create or replace function public.assign_team_task(
  p_organization_id uuid, p_task_id text, p_assignee_id uuid,
  p_payload jsonb default '{}'::jsonb, p_due_at timestamptz default null
)
returns setof public.team_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if public.org_role(p_organization_id, auth.uid()) not in ('owner', 'manager') then raise exception 'Owner or manager access required' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_task_id, ''))) < 1 then raise exception 'Task ID is required'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id and m.user_id = p_assignee_id and m.status = 'active'
  ) then raise exception 'Assignee must be an active teammate'; end if;
  insert into public.team_tasks (organization_id, task_id, visibility, owner_user_id, payload, completed, due_at, created_by, updated_at)
  values (p_organization_id, trim(p_task_id), 'team', p_assignee_id, coalesce(p_payload, '{}'::jsonb), false, p_due_at, auth.uid(), now())
  on conflict (organization_id, task_id) do update
    set visibility = 'team', owner_user_id = excluded.owner_user_id, payload = excluded.payload,
        due_at = excluded.due_at, updated_at = now();
  return query select * from public.team_tasks t
  where t.organization_id = p_organization_id and t.task_id = trim(p_task_id);
end;
$$;

create or replace function public.release_team_lead(p_organization_id uuid, p_lead_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  delete from public.lead_claims c
  where c.organization_id = p_organization_id and c.lead_id = p_lead_id
    and (c.claimed_by = auth.uid() or public.org_role(p_organization_id, auth.uid()) in ('owner', 'manager'));
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations for update to authenticated
using (public.org_role(id, auth.uid()) in ('owner', 'manager'))
with check (public.org_role(id, auth.uid()) in ('owner', 'manager'));

drop policy if exists memberships_select_team on public.memberships;
create policy memberships_select_team on public.memberships for select to authenticated
using (public.is_org_member(organization_id, auth.uid()) or user_id = auth.uid());

drop policy if exists team_leads_delete_owner on public.team_leads;
create policy team_leads_delete_owner on public.team_leads for delete to authenticated
using (created_by = auth.uid() or owner_user_id = auth.uid() or public.org_role(organization_id, auth.uid()) in ('owner', 'manager'));

drop policy if exists team_tasks_select_visible on public.team_tasks;
create policy team_tasks_select_visible on public.team_tasks for select to authenticated
using (
  public.is_org_member(organization_id, auth.uid()) and (
    public.org_role(organization_id, auth.uid()) in ('owner', 'manager')
    or owner_user_id = auth.uid() or created_by = auth.uid()
    or (visibility = 'team' and owner_user_id is null)
  )
);

drop policy if exists team_tasks_insert_member on public.team_tasks;
create policy team_tasks_insert_member on public.team_tasks for insert to authenticated
with check (
  public.is_org_member(organization_id, auth.uid()) and created_by = auth.uid()
  and (public.org_role(organization_id, auth.uid()) in ('owner', 'manager') or owner_user_id is null or owner_user_id = auth.uid())
);

drop policy if exists team_tasks_update_visible on public.team_tasks;
create policy team_tasks_update_visible on public.team_tasks for update to authenticated
using (
  public.is_org_member(organization_id, auth.uid())
  and (public.org_role(organization_id, auth.uid()) in ('owner', 'manager') or owner_user_id = auth.uid() or created_by = auth.uid())
)
with check (
  public.is_org_member(organization_id, auth.uid())
  and (public.org_role(organization_id, auth.uid()) in ('owner', 'manager') or owner_user_id = auth.uid() or created_by = auth.uid())
);

drop policy if exists team_tasks_delete_owner on public.team_tasks;
create policy team_tasks_delete_owner on public.team_tasks for delete to authenticated
using (created_by = auth.uid() or owner_user_id = auth.uid() or public.org_role(organization_id, auth.uid()) in ('owner', 'manager'));

grant update (name, open_join) on public.organizations to authenticated;

revoke all on function public.review_organization_membership(uuid, uuid, boolean), public.set_organization_member_role(uuid, uuid, text), public.assign_team_task(uuid, text, uuid, jsonb, timestamptz) from public;
grant execute on function public.review_organization_membership(uuid, uuid, boolean), public.set_organization_member_role(uuid, uuid, text), public.assign_team_task(uuid, text, uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.create_organization(text), public.join_organization_by_code(text), public.release_team_lead(uuid, text) to authenticated;

commit;
