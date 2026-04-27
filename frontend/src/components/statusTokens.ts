import type { Status } from '../types'

export const STATUS_LIST: Status[] = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

export const statusTokens: Record<Status, { text: string; bg: string; border: string; dot: string }> = {
  'Not Applied': { text: 'var(--not-applied)', bg: 'var(--not-applied-bg)', border: 'var(--not-applied-line)', dot: '#94a3b8' },
  'Applied':     { text: 'var(--applied)', bg: 'var(--applied-bg)', border: 'var(--applied-line)', dot: '#2563eb' },
  'Interview':   { text: 'var(--interview)', bg: 'var(--interview-bg)', border: 'var(--interview-line)', dot: '#6b4ef5' },
  'Offer':       { text: 'var(--offer)', bg: 'var(--offer-bg)', border: 'var(--offer-line)', dot: '#15803d' },
  'Rejected':    { text: 'var(--rejected)', bg: 'var(--rejected-bg)', border: 'var(--rejected-line)', dot: '#94a3b8' },
}

export function tokenFor(status: Status | string) {
  return statusTokens[status as Status] ?? statusTokens['Not Applied']
}
