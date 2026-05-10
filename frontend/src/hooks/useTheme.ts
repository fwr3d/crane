import { useEffect, useState } from 'react'

const STORAGE_KEY = 'crane-theme'

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    root.classList.add('theme-ready')
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  }, [dark])

  return {
    dark,
    toggleDark: () => setDark(value => !value),
  }
}
