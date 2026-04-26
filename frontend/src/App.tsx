import { useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Jobs } from './pages/Jobs'
import { AddJob } from './pages/AddJob'
import { Scrape } from './pages/Scrape'
import { api } from './api'

type Page = 'dashboard' | 'jobs' | 'add' | 'scrape'

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'jobs',      label: 'All Jobs' },
  { id: 'add',       label: 'Add Job' },
  { id: 'scrape',    label: 'Scrape' },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className="min-h-screen flex bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-slate-900 flex flex-col py-8 px-4 min-h-screen">
        <p className="text-white text-sm font-semibold px-2 mb-8 tracking-tight">Job Tracker</p>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`text-left text-sm px-3 py-2 rounded-lg font-medium transition-colors ${
                page === n.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <a
            href={api.exportUrl}
            className="block text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-2"
          >
            Export CSV
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-10 py-10 max-w-3xl">
        {page === 'dashboard' && <Dashboard />}
        {page === 'jobs'      && <Jobs />}
        {page === 'add'       && <AddJob />}
        {page === 'scrape'    && <Scrape />}
      </main>
    </div>
  )
}
