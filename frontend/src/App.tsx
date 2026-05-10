import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useEffect, useState } from 'react'
import { api } from './api'
import craneLogo from './assets/crane.svg'
import { SpotlightOverlay } from './components/SpotlightOverlay'
import { StatusDot } from './components/StatusBadge'
import { STATUS_LIST } from './components/statusTokens'
import { TutorialChecklist } from './components/TutorialChecklist'
import { useAuth } from './context/auth'
import { useIsMobile } from './hooks/useIsMobile'
import { useTheme } from './hooks/useTheme'
import { useTutorial } from './hooks/useTutorial'
import { Account } from './pages/Account'
import { Dashboard } from './pages/Dashboard'
import { Help } from './pages/Help'
import { Jobs } from './pages/Jobs'
import { Scrape } from './pages/Scrape'
import { Stats } from './pages/Stats'
import type { Stats as StatsSummary } from './types'

type Page = 'dashboard' | 'jobs' | 'scrape' | 'stats' | 'account' | 'help'

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Today' },
  { id: 'jobs', label: 'Board' },
  { id: 'scrape', label: 'Find' },
  { id: 'stats', label: 'Stats' },
  { id: 'account', label: 'Settings' },
]

const MOBILE_NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Today' },
  { id: 'jobs', label: 'Board' },
  { id: 'scrape', label: 'Find' },
  { id: 'stats', label: 'Stats' },
  { id: 'help', label: 'Help' },
]

function NavIcon({ page }: { page: Page }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (page === 'dashboard') {
    return (
      <svg {...common}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M3 10h18" />
      </svg>
    )
  }

  if (page === 'jobs') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  }

  if (page === 'scrape') {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    )
  }

  if (page === 'stats') {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16V9" />
        <path d="M12 16V6" />
        <path d="M16 16v-4" />
      </svg>
    )
  }

  if (page === 'help') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={3} strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.35.13.69.34 1 .6.3.3.44.69.4 1.1V11a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.31 0Z" />
    </svg>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { dark, toggleDark } = useTheme()
  const { profile, signOut } = useAuth()
  const isMobile = useIsMobile()
  const name = profile?.name?.trim() || 'You'
  const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => { api.stats().then(setStats).catch(() => undefined) }, [page])

  const tutorial = useTutorial(stats)
  const activeStep = tutorial.spotlight ? tutorial.steps.find(s => s.id === tutorial.spotlight) : null

  const navigate = (id: Page) => {
    setPage(id)
    if (isMobile) setSidebarOpen(false)
  }

  const goFind = () => {
    setPage('scrape')
    tutorial.markDone('find_jobs')
    if (isMobile) setSidebarOpen(false)
  }

  if (isMobile) {
    return (
      <div style={{ fontFamily: "'Figtree', system-ui, sans-serif", background: 'var(--paper)', color: 'var(--ink-800)', minHeight: '100dvh', width: '100%' }}>
        {/* Page content */}
        <main style={{ padding: '20px 16px 90px', minHeight: '100dvh', boxSizing: 'border-box', width: '100%' }}>
          {page === 'dashboard' && <Dashboard goJobs={() => setPage('jobs')} />}
          {page === 'jobs' && <Jobs goScrape={goFind} onStatusChange={() => tutorial.markDone('change_status')} onDeadlineSet={() => tutorial.markDone('set_deadline')} />}
          {page === 'scrape' && <Scrape />}
          {page === 'stats' && <Stats />}
          {page === 'account' && <Account dark={dark} toggleDark={toggleDark} onJobsCleared={() => setStats(null)} />}
          {page === 'help' && <Help />}
        </main>

        {/* Bottom nav */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: dark ? '#0b1018' : '#0c111d',
          display: 'flex', alignItems: 'stretch',
          paddingBottom: 'env(safe-area-inset-bottom)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          {MOBILE_NAV.map(n => (
            <button
              key={n.id}
              onClick={() => n.id === 'scrape' ? goFind() : navigate(n.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '10px 2px', border: 'none', background: 'transparent', cursor: 'pointer',
                color: page === n.id ? '#36d458' : '#64748b', minWidth: 0,
              }}
            >
              <span style={{ display: 'inline-flex', opacity: page === n.id ? 1 : 0.7 }}>
                <NavIcon page={n.id} />
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{n.label}</span>
            </button>
          ))}
        </nav>
        <Analytics />
        <SpeedInsights />
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif", background: 'var(--paper)', color: 'var(--ink-800)', display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}
      <aside style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto',
        background: dark ? '#0b1018' : '#0c111d',
        color: 'var(--action-text)',
        padding: '20px 14px',
        ...(isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s ease',
        } : {}),
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 6px 34px' }}>
          <img src={craneLogo} alt="Crane" style={{ width: 86, height: 84, marginBottom: 18 }} />
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', lineHeight: 1, textTransform: 'uppercase' }}>
            Crane
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', letterSpacing: '0.12em', marginTop: 6 }}>
            v1.1
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(n => (
            <button
              key={n.id}
              data-tutorial-id={n.id === 'scrape' ? 'find-nav' : undefined}
              onClick={() => n.id === 'scrape' ? goFind() : navigate(n.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 7,
                border: 'none',
                color: page === n.id ? 'var(--action-text)' : '#94a3b8',
                background: page === n.id ? 'rgba(148,163,184,0.12)' : 'transparent',
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 16, opacity: page === n.id ? 1 : 0.7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <NavIcon page={n.id} />
              </span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.id === 'dashboard' && stats && stats.stale > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--action-text)', background: 'rgba(194, 113, 12, 0.5)', padding: '1px 7px', borderRadius: 999 }}>
                  {stats.stale}
                </span>
              )}
              {n.id === 'jobs' && stats && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: page === n.id ? 'var(--action-text)' : '#64748b' }}>
                  {stats.total}
                </span>
              )}
            </button>
          ))}
        </nav>

        {stats && stats.total > 0 && (
          <div style={{ marginTop: 28, padding: '0 6px' }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
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
            <div style={{ width: 28, height: 28, borderRadius: 999, background: 'oklch(0.72 0.12 145)', color: '#0c111d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--action-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>{profile?.target_role || 'Job search'}</div>
            </div>
          </div>
          <button onClick={() => api.exportCsv().catch(error => window.alert(error instanceof Error ? error.message : 'Could not export jobs.'))} style={{ fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'block', marginBottom: 8 }}>
            Export CSV
          </button>
          <button onClick={toggleDark} aria-pressed={dark} style={{ fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'block', marginBottom: 8 }}>
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Clear all jobs? This cannot be undone.')) {
                api.jobs.clear()
                  .then(() => { setStats(null); window.location.reload() })
                  .catch(error => window.alert(error instanceof Error ? error.message : 'Could not clear jobs.'))
              }
            }}
            style={{ fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'block', marginBottom: 8 }}
          >
            Clear all jobs
          </button>
          <button onClick={() => signOut()} style={{ fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', padding: '36px 48px 60px' }}>
        {page === 'dashboard' && <Dashboard goJobs={() => setPage('jobs')} />}
        {page === 'jobs' && <Jobs goScrape={goFind} onStatusChange={() => tutorial.markDone('change_status')} onDeadlineSet={() => tutorial.markDone('set_deadline')} />}
        {page === 'scrape' && <Scrape />}
        {page === 'stats' && <Stats />}
        {page === 'account' && <Account dark={dark} toggleDark={toggleDark} onJobsCleared={() => setStats(null)} />}
        {page === 'help' && <Help />}
      </main>

      {activeStep && (
        <SpotlightOverlay
          step={activeStep}
          onDismiss={() => tutorial.setSpotlight(null)}
          onDone={() => { tutorial.markDone(activeStep.id); tutorial.setSpotlight(null) }}
        />
      )}
      {!tutorial.dismissed && !tutorial.allDone && (
        <TutorialChecklist
          steps={tutorial.steps}
          onSpotlight={tutorial.setSpotlight}
          onDismiss={tutorial.dismiss}
        />
      )}
      <Analytics />
      <SpeedInsights />
    </div>
  )
}
