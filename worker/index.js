import { validateTeamBootstrapPayload } from '../src/lib/teamBootstrap.js'

const API_SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
})

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...API_SECURITY_HEADERS,
      ...extraHeaders,
    },
  })
}

/** Cloudflare Worker entry point used by OpenAI Sites hosting. */
export default {
  fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/team-bootstrap') {
      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' })
      }

      const validation = validateTeamBootstrapPayload({
        supabaseUrl: env.SUPABASE_URL,
        supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
      })
      if (!validation.valid) {
        return json({ configured: false, error: 'Team bootstrap is not configured.' }, 503)
      }

      return json({
        configured: true,
        supabaseUrl: validation.url,
        supabasePublishableKey: validation.publishableKey,
      })
    }

    return env.ASSETS.fetch(request)
  },
}
