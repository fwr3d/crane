import type { ReactNode } from 'react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  console.info('Sentry DSN is configured, but @sentry/react is not installed in this build.', dsn)
}

export function SentryErrorBoundary({ children }: { children: ReactNode }) {
  return children
}
