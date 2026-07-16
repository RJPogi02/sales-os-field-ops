import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../worker/index.js'
import {
  fetchTeamBootstrap, isUnsafeSupabaseKey, validateTeamBootstrapPayload,
} from '../src/lib/teamBootstrap.js'

function jwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
}

test('bootstrap validation accepts publishable config and rejects privileged keys', () => {
  const safe = validateTeamBootstrapPayload({
    supabaseUrl: 'https://demo.supabase.co/',
    supabasePublishableKey: 'sb_publishable_public-value',
  })
  assert.equal(safe.valid, true)
  assert.equal(safe.url, 'https://demo.supabase.co')
  assert.equal(isUnsafeSupabaseKey('sb_secret_private-value'), true)
  assert.equal(isUnsafeSupabaseKey(jwt({ role: 'service_role' })), true)
  assert.equal(isUnsafeSupabaseKey(jwt({ role: 'anon' })), false)
})

test('fetch helper requests same-origin bootstrap without caching and normalizes config', async () => {
  let received
  const config = await fetchTeamBootstrap({
    fetchImpl: async (url, init) => {
      received = { url, init }
      return new Response(JSON.stringify({
        supabaseUrl: 'https://demo.supabase.co',
        supabasePublishableKey: 'sb_publishable_public-value',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    },
  })
  assert.equal(received.url, '/api/team-bootstrap')
  assert.equal(received.init.cache, 'no-store')
  assert.equal(received.init.credentials, 'same-origin')
  assert.deepEqual(config, { url: 'https://demo.supabase.co', anonKey: 'sb_publishable_public-value' })
})

test('fetch helper surfaces a safe server error', async () => {
  await assert.rejects(
    fetchTeamBootstrap({
      fetchImpl: async () => new Response(JSON.stringify({ error: 'Team bootstrap is not configured.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),
    /not configured/i,
  )
})

test('worker serves bootstrap with no-store security headers', async () => {
  const response = await worker.fetch(new Request('https://sales.test/api/team-bootstrap'), {
    SUPABASE_URL: 'https://demo.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public-value',
    ASSETS: { fetch: () => { throw new Error('assets should not handle the API') } },
  })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await response.json()).configured, true)
})

test('worker returns 503 when bootstrap bindings are missing', async () => {
  const response = await worker.fetch(new Request('https://sales.test/api/team-bootstrap'), {
    ASSETS: { fetch: () => { throw new Error('assets should not handle the API') } },
  })
  assert.equal(response.status, 503)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.deepEqual(await response.json(), {
    configured: false,
    error: 'Team bootstrap is not configured.',
  })
})

test('worker delegates non-bootstrap requests to the asset binding', async () => {
  let delegated = false
  const expected = new Response('asset', { status: 200 })
  const response = await worker.fetch(new Request('https://sales.test/mission'), {
    ASSETS: { fetch: () => { delegated = true; return expected } },
  })
  assert.equal(delegated, true)
  assert.equal(response, expected)
})
