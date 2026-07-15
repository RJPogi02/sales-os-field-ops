let googleLoader
let googleLoaderKey = ''

function readableGoogleError(error) {
  const message = String(error?.message || error || 'Google Places request failed')
  if (/referer.*not.*allowed/i.test(message)) return new Error('Google blocked this Sales OS address. Add the exact http://127.0.0.1 port shown in your browser to the key\'s Website restrictions.')
  if (/api.*not.*activated|api.*target.*blocked/i.test(message)) return new Error('This key is not authorized for Maps JavaScript API and Places API (New). Enable or allow both APIs in the key\'s Google Cloud project.')
  if (/billing.*not.*enabled/i.test(message)) return new Error('Google requires billing for this project or request. A Maps Demo Key can be used only within its prototype feature and quota limits.')
  if (/over.*quota|resource_exhausted/i.test(message)) return new Error('This Google project has reached its current Places quota. Check Maps Platform quotas or try again after the quota resets.')
  return new Error(message)
}

export function buildGooglePlacesSearchRequest(textQuery, maxResultCount = 20) {
  return {
    textQuery,
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteURI', 'googleMapsURI', 'businessStatus'],
    region: 'ph',
    maxResultCount: Math.min(20, Math.max(1, Number(maxResultCount) || 1)),
    language: 'en',
  }
}

export function loadGooglePlaces(apiKey) {
  const normalizedKey = String(apiKey || '').trim()
  if (!normalizedKey) return Promise.reject(new Error('Add a restricted Google Maps browser key in Settings first'))
  if (globalThis.google?.maps?.importLibrary) {
    if (googleLoaderKey && googleLoaderKey !== normalizedKey) return Promise.reject(new Error('The Google key changed after Maps loaded. Refresh Sales OS once, then test the new key.'))
    googleLoaderKey ||= normalizedKey
    return globalThis.google.maps.importLibrary('places').catch((error) => { throw readableGoogleError(error) })
  }
  if (googleLoader && googleLoaderKey === normalizedKey) return googleLoader
  googleLoader = null
  googleLoaderKey = normalizedKey
  googleLoader = new Promise((resolve, reject) => {
    const callback = `salesOsGoogleReady${Date.now()}`
    globalThis[callback] = async () => {
      try { resolve(await globalThis.google.maps.importLibrary('places')) } catch (error) {
        googleLoader = null
        googleLoaderKey = ''
        reject(readableGoogleError(error))
      }
      delete globalThis[callback]
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(normalizedKey)}&v=weekly&loading=async&libraries=places&callback=${callback}`
    script.async = true
    script.onerror = () => {
      googleLoader = null
      googleLoaderKey = ''
      delete globalThis[callback]
      reject(new Error('Google Places could not load. Check the key, Website/API restrictions, quota, and internet connection.'))
    }
    document.head.appendChild(script)
  })
  return googleLoader
}

export async function searchGooglePlacesText(apiKey, textQuery, maxResultCount = 20) {
  const { Place } = await loadGooglePlaces(apiKey)
  try {
    const response = await Place.searchByText(buildGooglePlacesSearchRequest(textQuery, maxResultCount))
    return response.places || []
  } catch (error) {
    throw readableGoogleError(error)
  }
}
