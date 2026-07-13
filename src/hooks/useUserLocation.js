import { useEffect, useState } from 'react'

export function useUserLocation() {
  const [enabled, setEnabled] = useState(false)
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('Location off')

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return undefined
    setStatus('Locating…')
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude])
        setStatus(`±${Math.round(coords.accuracy)}m`)
      },
      (error) => setStatus(error.code === 1 ? 'Permission denied' : 'Location unavailable'),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled])

  return { position, status, enabled, enable: () => setEnabled(true) }
}
