import type { Status } from '../types'

const config: Record<string, { text: string; bg: string; border: string }> = {
  'Not Applied': { text: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  'Applied':     { text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  'Interview':   { text: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  'Offer':       { text: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  'Rejected':    { text: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

export function StatusBadge({ status }: { status: Status | string }) {
  const c = config[status] ?? { text: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
  return (
    <span
      style={{
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}
