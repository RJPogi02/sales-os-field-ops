import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('v0.09 migration maps legacy roles without redefining atomic lead claims', async () => {
  const migration = await read('../supabase/migrations/20260715_v009_team_roles.sql')
  assert.match(migration, /when 'admin' then 'manager' when 'member' then 'rep'/i)
  assert.match(migration, /status in \('pending', 'active', 'rejected'\)/i)
  assert.doesNotMatch(migration, /create(?:\s+or\s+replace)?\s+function\s+public\.claim_team_lead/i)
})

test('fresh schema approval gates membership and manager task assignment', async () => {
  const schema = await read('../supabase/schema.sql')
  assert.match(schema, /role in \('owner', 'manager', 'rep'\)/i)
  assert.match(schema, /case when v_org\.open_join then 'active' else 'pending' end/i)
  assert.match(schema, /review_organization_membership/i)
  assert.match(schema, /assign_team_task/i)
  assert.match(schema, /public\.org_role\(organization_id, auth\.uid\(\)\) in \('owner', 'manager'\)/i)
  assert.match(schema, /v_actor_role <> 'owner'.*Owner access required to change team roles/is)
  assert.match(schema, /memberships_select_team[\s\S]*or user_id = auth\.uid\(\)/i)
})
