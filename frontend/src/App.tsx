import { useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Jobs } from './pages/Jobs'
import { AddJob } from './pages/AddJob'
import { Scrape } from './pages/Scrape'
import { api } from './api'
import craneLogo from './assets/crane.svg'

type Page = 'dashboard' | 'jobs' | 'add' | 'scrape'

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'jobs',      label: 'All Jobs'  },
  { id: 'add',       label: 'Add Job'   },
  { id: 'scrape',    label: 'Scrape'    },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Figtree', system-ui, sans-serif", background: '#f8fafc' }}>

      {/* Sidebar */}
      <aside className="w-48 shrink-0 flex flex-col py-7 px-3 min-h-screen" style={{ background: '#0c111d' }}>
        <div className="flex flex-col items-center mb-8 pt-2">
          <img src={craneLogo} alt="Crane" style={{ width: '52px', height: '52px' }} />
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '0.8rem', fontWeight: 700, color: 'white', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '10px' }}>
            Crane
          </p>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className="text-left text-sm py-2 transition-colors"
              style={{
                paddingLeft: '11px',
                color: page === n.id ? 'white' : '#64748b',
                fontWeight: page === n.id ? 500 : 400,
                background: 'none',
                border: 'none',
                borderLeft: page === n.id ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (page !== n.id) (e.target as HTMLElement).style.color = '#94a3b8' }}
              onMouseLeave={e => { if (page !== n.id) (e.target as HTMLElement).style.color = '#64748b' }}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto px-3 flex flex-col gap-2">
          <a
            href={api.exportUrl}
            style={{ fontSize: '0.72rem', color: '#334155' }}
            className="hover:text-slate-400 transition-colors"
          >
            Export CSV
          </a>
          <button
            onClick={() => {
              if (window.confirm('Clear all jobs? This cannot be undone.')) {
                api.jobs.clear().then(() => window.location.reload())
              }
            }}
            style={{ fontSize: '0.72rem', color: '#334155', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#ef4444'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#334155'}
          >
            Clear all jobs
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-12 py-10" style={{ maxWidth: '860px' }}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'jobs'      && <Jobs />}
        {page === 'add'       && <AddJob />}
        {page === 'scrape'    && <Scrape />}
      </main>
    </div>
  )
}
