-- Sales OS v0.082 Team Hub reliability migration
-- Safe to run after the original v0.08 schema. New installs receive the same function from schema.sql.

create index if not exists call_events_lead_time_idx
on public.call_events(organization_id, lead_id, occurred_at desc);

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

  perform 1 from public.team_leads l
  where l.organization_id = p_organization_id and l.lead_id = p_lead_id
    and (l.visibility = 'team' or l.owner_user_id = auth.uid())
  for update;
  if not found then raise exception 'Lead is unavailable to this operator' using errcode = '42501'; end if;

  -- One teammate attempt per Manila workday. The same operator may still make a planned retry.
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

revoke all on function public.claim_team_lead(uuid, text, integer) from public;
grant execute on function public.claim_team_lead(uuid, text, integer) to authenticated;
