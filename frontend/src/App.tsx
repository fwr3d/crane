import { useState, useEffect } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Jobs } from './pages/Jobs'
import { Scrape } from './pages/Scrape'
import { api } from './api'
import type { Stats } from './types'
import craneLogo from './assets/crane.svg'
import { StatusDot } from './components/StatusBadge'
import { STATUS_LIST } from './components/statusTokens'
import { useAuth } from './context/auth'

type Page = 'dashboard' | 'jobs' | 'scrape'

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Today' },
  { id: 'jobs',      label: 'Board' },
  { id: 'scrape',    label: 'Find'  },
]

const navIcon: Record<Page, string> = {
  dashboard: '▤',
  jobs:      '▦',
  scrape:    '⌕',
}

export default function App() {
  const [page,  setPage]  = useState<Page>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const { profile, signOut } = useAuth()
  const name = profile?.name?.trim() || 'You'
  const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => { api.stats().then(setStats).catch(() => {}) }, [page])

  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif", background: 'var(--paper)', display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', background: 'var(--ink-900)', color: 'white', padding: '20px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 6px 34px' }}>
          <img src={craneLogo} alt="Crane" style={{ width: 86, height: 84, marginBottom: 18 }} />
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', lineHeight: 1, textTransform: 'uppercase' }}>
            Crane
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', letterSpacing: '0.12em', marginTop: 6 }}>
            v1.0
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 7,
                border: 'none',
                color: page === n.id ? 'white' : '#94a3b8',
                background: page === n.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => {
                if (page !== n.id) {
                  e.currentTarget.style.color = '#cbd5e1'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                }
              }}
              onMouseLeave={e => {
                if (page !== n.id) {
                  e.currentTarget.style.color = '#94a3b8'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <span style={{ width: 16, opacity: page === n.id ? 1 : 0.7, textAlign: 'center' }}>{navIcon[n.id]}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.id === 'dashboard' && stats && stats.stale > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'white', background: 'rgba(194, 113, 12, 0.5)', padding: '1px 7px', borderRadius: 999 }}>
                  {stats.stale}
                </span>
              )}
              {n.id === 'jobs' && stats && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: page === n.id ? 'white' : '#64748b' }}>
                  {stats.total}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Pipeline counts */}
        {stats && stats.total > 0 && (
          <div style={{ marginTop: 28, padding: '0 6px' }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: '#475569', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
              Pipeline
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STATUS_LIST.map(status => {
                const count = stats.by_status[status] ?? 0
                return (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#94a3b8' }}>
                    <StatusDot status={status} size={5} />
                    <span style={{ flex: 1 }}>{status}</span>
                    <span className="tabular" style={{ color: '#cbd5e1', fontWeight: 600 }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', padding: '14px 6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: 'oklch(0.72 0.12 145)',
              color: 'var(--ink-900)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 10.5, color: '#475569' }}>{profile?.target_role || 'Job search'}</div>
            </div>
          </div>
          <a
            href={api.exportUrl}
            style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 8 }}
            className="hover:text-slate-400 transition-colors"
          >
            Export CSV
          </a>
          <button
            onClick={() => {
              if (window.confirm('Clear all jobs? This cannot be undone.')) {
                api.jobs.clear().then(() => { setStats(null); window.location.reload() })
              }
            }}
            style={{ fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'block', marginBottom: 8 }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#ef4444'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#64748b'}
          >
            Clear all jobs
          </button>
          <button
            onClick={() => signOut()}
            style={{ fontSize: '0.72rem', color: '#475569', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#94a3b8'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', padding: '36px 48px 60px' }}>
        {page === 'dashboard' && <Dashboard goJobs={() => setPage('jobs')} />}
        {page === 'jobs'      && <Jobs goScrape={() => setPage('scrape')} />}
        {page === 'scrape'    && <Scrape />}
      </main>
    </div>
  )
}
