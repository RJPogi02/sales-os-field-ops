/** Cloudflare Worker entry point used by OpenAI Sites hosting. */
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request)
  },
}
