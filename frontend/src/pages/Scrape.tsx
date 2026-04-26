import { useState } from 'react'
import { api } from '../api'
import type { Job } from '../types'

export function Scrape() {
  const [search, setSearch] = useState('Software Engineer')
  const [location, setLocation] = useState('California')
  const [results, setResults] = useState<Job[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)

  const scrape = async () => {
    setLoading(true)
    setResults(null)
    setSelected(new Set())
    setDone(false)
    const jobs = await api.scrape(search, location)
    setResults(jobs)
    setLoading(false)
  }

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    if (!results) return
    setSelected(selected.size === results.length ? new Set() : new Set(results.map((_, i) => i)))
  }

  const addSelected = async () => {
    if (!results) return
    setAdding(true)
    const jobs = [...selected].map(i => results[i])
    await Promise.all(
      jobs.map(j => api.jobs.create({ company: j.company, position: j.position, status: 'Not Applied' }))
    )
    setAdding(false)
    setDone(true)
    setResults(null)
  }

  return (
    <div className="space-y-6">
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Scrape LinkedIn</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-lg">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5">Job title</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-400 transition-colors"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5">Location</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-400 transition-colors"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={scrape}
          disabled={loading}
          className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Scraping...' : 'Search LinkedIn'}
        </button>
      </div>

      {done && <p className="text-sm text-emerald-600 font-medium">Jobs added successfully.</p>}

      {results !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{results.length} jobs found</p>
            <button onClick={toggleAll} className="text-xs text-slate-500 hover:text-slate-900 transition-colors">
              {selected.size === results.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="space-y-1.5">
            {results.map((job, i) => (
              <label
                key={i}
                className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                  selected.has(i) ? 'border-slate-400' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="accent-slate-900"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{job.position}</p>
                  <p className="text-xs text-slate-400 truncate">{job.company}</p>
                </div>
              </label>
            ))}
          </div>

          {selected.size > 0 && (
            <button
              onClick={addSelected}
              disabled={adding}
              className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {adding ? 'Adding...' : `Add ${selected.size} job${selected.size > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
