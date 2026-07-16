export const TEAM_BOOTSTRAP_ENDPOINT = '/api/team-bootstrap'

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function isLocalUrl(url) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)
}

function decodeJwtPayload(value) {
  const parts = String(value || '').trim().split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

export function isUnsafeSupabaseKey(value) {
  const key = String(value || '').trim()
  if (/^sb_secret_/i.test(key)) return true
  const payload = decodeJwtPayload(key)
  return String(payload?.role || '').toLowerCase() === 'service_role'
}

export function validateTeamBootstrapPayload(payload = {}) {
  const url = cleanUrl(payload.supabaseUrl || payload.url)
  const publishableKey = String(
    payload.supabasePublishableKey || payload.publishableKey || payload.anonKey || '',
  ).trim()
  const errors = []

  if (!url) errors.push('Supabase project URL is missing.')
  else {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && !isLocalUrl(url)) {
        errors.push('Supabase project URL must use HTTPS.')
      }
    } catch {
      errors.push('Supabase project URL is invalid.')
    }
  }

  if (!publishableKey) errors.push('Supabase publishable key is missing.')
  else if (isUnsafeSupabaseKey(publishableKey)) {
    errors.push('A secret or service-role key cannot be used in the browser.')
  }

  return { valid: errors.length === 0, errors, url, publishableKey }
}

export async function fetchTeamBootstrap({
  fetchImpl = globalThis.fetch,
  endpoint = TEAM_BOOTSTRAP_ENDPOINT,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Team bootstrap fetch is unavailable.')

  let response
  try {
    response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    })
  } catch {
    throw new Error('Could not reach the team bootstrap service.')
  }

  let payload = null
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) {
    throw new Error(payload?.error || `Team bootstrap failed (${response.status}).`)
  }

  const validation = validateTeamBootstrapPayload(payload)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  return { url: validation.url, anonKey: validation.publishableKey }
}
