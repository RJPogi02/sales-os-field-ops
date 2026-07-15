import { useEffect, useState } from 'react'

export function usePersistentState(key, initialValue, revive = (value) => value) {
  const [value, setValue] = useState(() => {
    const fallback = () => typeof initialValue === 'function' ? initialValue() : initialValue
    try {
      const stored = localStorage.getItem(key)
      return revive(stored ? JSON.parse(stored) : fallback())
    } catch {
      return revive(fallback())
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
