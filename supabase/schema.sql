-- Sales OS v0.09 optional team workspace with approval-gated roles
-- Run once in a new Supabase project's SQL editor. Local-only mode needs none of this.
-- Browser clients must use the anon/publishable key; never expose the service-role key.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Sales operator' check (char_length(display_name) between 1 and 100),
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
  open_join boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  organization_id uuid not null,
  user_id uuid not null,
  role text not null default 'rep' check (role in ('owner', 'manager', 'rep')),
  status text not null default 'active' check (status in ('pending', 'active', 'rejected')),
  requested_at timestamptz not null default now(),
  joined_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  constraint memberships_pkey primary key (organization_id, user_id),
  constraint memberships_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint memberships_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade
);

create table if not exists public.team_leads (
  organization_id uuid not null,
  lead_id text not null check (char_length(lead_id) between 1 and 180),
  visibility text not null default 'team' check (visibility in ('team', 'private')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_leads_pkey primary key (organization_id, lead_id),
  constraint team_leads_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint private_lead_has_owner check (visibility = 'team' or owner_user_id is not null)
);

create table if not exists public.lead_claims (
  organization_id uuid not null,
  lead_id text not null,
  claimed_by uuid not null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint lead_claims_pkey primary key (organization_id, lead_id),
  constraint lead_claims_lead_fkey foreign key (organization_id, lead_id) references public.team_leads(organization_id, lead_id) on delete cascade,
  constraint lead_claims_claimed_by_fkey foreign key (claimed_by) references public.profiles(id) on delete cascade,
  constraint claim_expiry_after_start check (expires_at > claimed_at)
);

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id text not null,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  result text not null default '',
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.team_tasks (
  organization_id uuid not null,
  task_id text not null check (char_length(task_id) between 1 and 180),
  visibility text not null default 'team' check (visibility in ('team', 'private')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  due_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_tasks_pkey primary key (organization_id, task_id),
  constraint team_tasks_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint private_task_has_owner check (visibility = 'team' or owner_user_id is not null)
);

create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists team_leads_updated_idx on public.team_leads(organization_id, updated_at desc);
create index if not exists team_leads_owner_idx on public.team_leads(organization_id, owner_user_id);
create index if not exists lead_claims_expiry_idx on public.lead_claims(organization_id, expires_at);
create index if not exists call_events_org_time_idx on public.call_events(organization_id, occurred_at desc);
create index if not exists call_events_lead_time_idx on public.call_events(organization_id, lead_id, occurred_at desc);
create index if not exists call_events_user_time_idx on public.call_events(user_id, occurred_at desc);
create index if not exists team_tasks_due_idx on public.team_tasks(organization_id, completed, due_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();

-- team_leads and team_tasks accept client-provided updated_at values for deterministic offline conflict resolution.

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
  -- Last-write-wins for offline clients; an older laptop snapshot cannot overwrite a newer team record.
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

drop trigger if exists team_leads_protect_scope on public.team_leads;
create trigger team_leads_protect_scope before update on public.team_leads for each row execute function public.protect_shared_record_scope();
drop trigger if exists team_tasks_protect_scope on public.team_tasks;
create trigger team_tasks_protect_scope before update on public.team_tasks for each row execute function public.protect_shared_record_scope();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Sales operator'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

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

create or replace function public.create_organization(p_name text)
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

create or replace function public.join_organization_by_code(p_invite_code text)
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
    v_org.id,
    auth.uid(),
    'rep',
    case when v_org.open_join then 'active' else 'pending' end,
    case when v_org.open_join then now() else null end,
    case when v_org.open_join then now() else null end,
    case when v_org.open_join then v_org.created_by else null end
  )
  on conflict (organization_id, user_id) do update
    set status = case
      when public.memberships.status = 'active' then 'active'
      when v_org.open_join then 'active'
      else 'pending'
    end,
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
  p_organization_id uuid,
  p_user_id uuid,
  p_approved boolean default true
)
returns table (user_id uuid, role text, status text, joined_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target public.memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_actor_role := public.org_role(p_organization_id, auth.uid());
  if v_actor_role not in ('owner', 'manager') then raise exception 'Owner or manager access required' using errcode = '42501'; end if;

  select * into v_target from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id
  for update;
  if v_target.user_id is null then raise exception 'Membership request not found'; end if;
  if v_target.role = 'owner' then raise exception 'The owner membership cannot be reviewed'; end if;

  update public.memberships m
  set status = case when p_approved then 'active' else 'rejected' end,
      role = case when p_approved then 'rep' else m.role end,
      joined_at = case when p_approved then coalesce(m.joined_at, now()) else null end,
      approved_at = now(),
      approved_by = auth.uid()
  where m.organization_id = p_organization_id and m.user_id = p_user_id;

  return query select m.user_id, m.role, m.status, m.joined_at
  from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
end;
$$;

create or replace function public.set_organization_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
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
  where m.organization_id = p_organization_id and m.user_id = p_user_id and m.status = 'active'
  for update;
  if v_target.user_id is null then raise exception 'Active membership not found'; end if;
  if v_target.role = 'owner' then raise exception 'The owner role cannot be changed'; end if;

  update public.memberships m set role = v_role
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
  return query select m.user_id, m.role, m.status from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
end;
$$;

create or replace function public.assign_team_task(
  p_organization_id uuid,
  p_task_id text,
  p_assignee_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_due_at timestamptz default null
)
returns setof public.team_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if public.org_role(p_organization_id, auth.uid()) not in ('owner', 'manager') then
    raise exception 'Owner or manager access required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_task_id, ''))) < 1 then raise exception 'Task ID is required'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id and m.user_id = p_assignee_id and m.status = 'active'
  ) then raise exception 'Assignee must be an active teammate'; end if;

  insert into public.team_tasks (
    organization_id, task_id, visibility, owner_user_id, payload, completed, due_at, created_by, updated_at
  ) values (
    p_organization_id, trim(p_task_id), 'team', p_assignee_id, coalesce(p_payload, '{}'::jsonb), false, p_due_at, auth.uid(), now()
  )
  on conflict (organization_id, task_id) do update
    set visibility = 'team',
        owner_user_id = excluded.owner_user_id,
        payload = excluded.payload,
        due_at = excluded.due_at,
        updated_at = now();

  return query select * from public.team_tasks t
  where t.organization_id = p_organization_id and t.task_id = trim(p_task_id);
end;
$$;

create or replace function public.claim_team_lead(p_organization_id uuid, p_lead_id text, p_ttl_seconds integer default 1800)
returns table (acquired boolean, claimed_by uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.lead_claims%rowtype;
  v_acquired boolean := false;
  v_ttl integer := greatest(60, least(coalesce(p_ttl_seconds, 1800), 14400));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not public.is_org_member(p_organization_id, auth.uid()) then raise exception 'Not a team member' using errcode = '42501'; end if;
  -- Lock the shared lead row so the visibility check, today's teammate-call check,
  -- and claim mutation form one server transaction. This closes stale roster/direct-call bypasses.
  perform 1 from public.team_leads l
  where l.organization_id = p_organization_id and l.lead_id = p_lead_id
    and (l.visibility = 'team' or l.owner_user_id = auth.uid())
  for update;
  if not found then raise exception 'Lead is unavailable to this operator' using errcode = '42501'; end if;

  if exists (
    select 1 from public.call_events e
    where e.organization_id = p_organization_id
      and e.lead_id = p_lead_id
      and e.user_id <> auth.uid()
      and timezone('Asia/Manila', e.occurred_at)::date = timezone('Asia/Manila', now())::date
  ) then
    return query select false, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.lead_claims (organization_id, lead_id, claimed_by, claimed_at, expires_at)
  values (p_organization_id, p_lead_id, auth.uid(), now(), now() + make_interval(secs => v_ttl))
  on conflict (organization_id, lead_id) do update
    set claimed_by = excluded.claimed_by, claimed_at = excluded.claimed_at, expires_at = excluded.expires_at
    where public.lead_claims.expires_at <= now() or public.lead_claims.claimed_by = auth.uid()
  returning * into v_claim;

  if v_claim.organization_id is not null then
    v_acquired := true;
  else
    select c.* into v_claim from public.lead_claims c
    where c.organization_id = p_organization_id and c.lead_id = p_lead_id;
  end if;
  return query select v_acquired, v_claim.claimed_by, v_claim.expires_at;
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

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.team_leads enable row level security;
alter table public.lead_claims enable row level security;
alter table public.call_events enable row level security;
alter table public.team_tasks enable row level security;

drop policy if exists profiles_select_team on public.profiles;
create policy profiles_select_team on public.profiles for select to authenticated
using (id = auth.uid() or public.shares_organization(id, auth.uid()));
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations for select to authenticated
using (public.is_org_member(id, auth.uid()));
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations for update to authenticated
using (public.org_role(id, auth.uid()) in ('owner', 'manager'))
with check (public.org_role(id, auth.uid()) in ('owner', 'manager'));

drop policy if exists memberships_select_team on public.memberships;
create policy memberships_select_team on public.memberships for select to authenticated
using (
  public.is_org_member(organization_id, auth.uid())
  or user_id = auth.uid()
);

drop policy if exists team_leads_select_visible on public.team_leads;
create policy team_leads_select_visible on public.team_leads for select to authenticated
using (public.is_org_member(organization_id, auth.uid()) and (visibility = 'team' or owner_user_id = auth.uid()));
drop policy if exists team_leads_insert_member on public.team_leads;
create policy team_leads_insert_member on public.team_leads for insert to authenticated
with check (public.is_org_member(organization_id, auth.uid()) and created_by = auth.uid() and (visibility = 'team' or owner_user_id = auth.uid()));
drop policy if exists team_leads_update_visible on public.team_leads;
create policy team_leads_update_visible on public.team_leads for update to authenticated
using (public.is_org_member(organization_id, auth.uid()) and (visibility = 'team' or owner_user_id = auth.uid()))
with check (public.is_org_member(organization_id, auth.uid()) and (visibility = 'team' or owner_user_id = auth.uid()));
drop policy if exists team_leads_delete_owner on public.team_leads;
create policy team_leads_delete_owner on public.team_leads for delete to authenticated
using (created_by = auth.uid() or owner_user_id = auth.uid() or public.org_role(organization_id, auth.uid()) in ('owner', 'manager'));

drop policy if exists lead_claims_select_team on public.lead_claims;
create policy lead_claims_select_team on public.lead_claims for select to authenticated
using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists call_events_select_team on public.call_events;
create policy call_events_select_team on public.call_events for select to authenticated
using (public.is_org_member(organization_id, auth.uid()));
drop policy if exists call_events_insert_self on public.call_events;
create policy call_events_insert_self on public.call_events for insert to authenticated
with check (user_id = auth.uid() and public.is_org_member(organization_id, auth.uid()));

drop policy if exists team_tasks_select_visible on public.team_tasks;
create policy team_tasks_select_visible on public.team_tasks for select to authenticated
using (
  public.is_org_member(organization_id, auth.uid())
  and (
    public.org_role(organization_id, auth.uid()) in ('owner', 'manager')
    or owner_user_id = auth.uid()
    or created_by = auth.uid()
    or (visibility = 'team' and owner_user_id is null)
  )
);
drop policy if exists team_tasks_insert_member on public.team_tasks;
create policy team_tasks_insert_member on public.team_tasks for insert to authenticated
with check (
  public.is_org_member(organization_id, auth.uid())
  and created_by = auth.uid()
  and (
    public.org_role(organization_id, auth.uid()) in ('owner', 'manager')
    or owner_user_id is null
    or owner_user_id = auth.uid()
  )
);
drop policy if exists team_tasks_update_visible on public.team_tasks;
create policy team_tasks_update_visible on public.team_tasks for update to authenticated
using (
  public.is_org_member(organization_id, auth.uid())
  and (
    public.org_role(organization_id, auth.uid()) in ('owner', 'manager')
    or owner_user_id = auth.uid()
    or created_by = auth.uid()
  )
)
with check (
  public.is_org_member(organization_id, auth.uid())
  and (
    public.org_role(organization_id, auth.uid()) in ('owner', 'manager')
    or owner_user_id = auth.uid()
    or created_by = auth.uid()
  )
);
drop policy if exists team_tasks_delete_owner on public.team_tasks;
create policy team_tasks_delete_owner on public.team_tasks for delete to authenticated
using (created_by = auth.uid() or owner_user_id = auth.uid() or public.org_role(organization_id, auth.uid()) in ('owner', 'manager'));

revoke all on public.profiles, public.organizations, public.memberships, public.team_leads, public.lead_claims, public.call_events, public.team_tasks from anon;
grant select, insert on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant update (name, open_join) on public.organizations to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, delete on public.team_leads to authenticated;
grant update (visibility, owner_user_id, payload, updated_at) on public.team_leads to authenticated;
grant select on public.lead_claims to authenticated;
grant select, insert on public.call_events to authenticated;
grant select, insert, delete on public.team_tasks to authenticated;
grant update (visibility, owner_user_id, payload, completed, due_at, updated_at) on public.team_tasks to authenticated;

revoke all on function public.is_org_member(uuid, uuid), public.org_role(uuid, uuid), public.shares_organization(uuid, uuid), public.create_organization(text), public.join_organization_by_code(text), public.review_organization_membership(uuid, uuid, boolean), public.set_organization_member_role(uuid, uuid, text), public.assign_team_task(uuid, text, uuid, jsonb, timestamptz), public.claim_team_lead(uuid, text, integer), public.release_team_lead(uuid, text) from public;
grant execute on function public.is_org_member(uuid, uuid), public.org_role(uuid, uuid), public.shares_organization(uuid, uuid), public.create_organization(text), public.join_organization_by_code(text), public.review_organization_membership(uuid, uuid, boolean), public.set_organization_member_role(uuid, uuid, text), public.assign_team_task(uuid, text, uuid, jsonb, timestamptz), public.claim_team_lead(uuid, text, integer), public.release_team_lead(uuid, text) to authenticated;

commit;
