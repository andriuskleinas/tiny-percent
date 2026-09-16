import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'tp-theme'

function current(): Theme {
  const stamped = document.documentElement.dataset.theme
  if (stamped === 'light' || stamped === 'dark') return stamped
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * A light/dark switch. The saved choice is applied before paint by
 * /theme.js; until this mounts the server-rendered switch shows no position,
 * so hydration never disagrees with it.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | undefined>(undefined)
  useEffect(() => setTheme(current()), [])

  const dark = theme === 'dark'
  const flip = () => {
    const next: Theme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private windows may refuse storage; the switch still works for this visit.
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={flip}
      className="relative inline-flex h-8 w-[3.75rem] shrink-0 items-center rounded-full border border-rule bg-sunk p-0.5 outline-none transition-colors hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span
        aria-hidden="true"
        className={`flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-rule transition-transform duration-200 ease-out motion-reduce:transition-none ${
          dark ? 'translate-x-[1.75rem]' : 'translate-x-0'
        } ${theme === undefined ? 'opacity-0' : 'opacity-100'}`}
      >
        {dark ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  )
}
