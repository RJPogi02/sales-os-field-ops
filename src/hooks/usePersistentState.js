import { useEffect, useState } from 'react'

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const fallback = () => typeof initialValue === 'function' ? initialValue() : initialValue
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : fallback()
    } catch {
      return fallback()
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
