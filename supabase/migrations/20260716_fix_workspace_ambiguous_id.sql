-- Sales OS v0.09.2 hotfix
-- PL/pgSQL RETURNS TABLE fields are variables. Both RPCs return an `id`
-- field, so ON CONFLICT (id) was ambiguous. Target the profile primary-key
-- constraint explicitly in both workspace entry points.

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
  on conflict on constraint profiles_pkey do nothing;

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
  on conflict on constraint profiles_pkey do nothing;
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
