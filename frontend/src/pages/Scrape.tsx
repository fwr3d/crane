import { useState } from 'react'
import { api } from '../api'
import type { Job } from '../types'

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #cbd5e1', borderRadius: '12px',
  padding: '12px 14px', fontSize: '0.875rem', outline: 'none',
  color: '#0f172a', background: '#fafbfc', boxSizing: 'border-box',
  transition: 'all 200ms ease',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748b',
  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px',
}

export function Scrape() {
  const [search,        setSearch]        = useState('Software Engineer')
  const [location,      setLocation]      = useState('California')
  const [companyFilter, setCompanyFilter] = useState('')
  const [results,       setResults]       = useState<Job[] | null>(null)
  const [selected,      setSelected]      = useState<Set<number>>(new Set())
  const [loading,       setLoading]       = useState(false)
  const [adding,        setAdding]        = useState(false)
  const [done,          setDone]          = useState(false)

  const scrape = async () => {
    setLoading(true)
    setResults(null)
    setSelected(new Set())
    setDone(false)
    const jobs = await api.scrape(search, location)
    const filtered = companyFilter
      ? jobs.filter(job => job.company.toLowerCase().includes(companyFilter.toLowerCase()))
      : jobs
    setResults(filtered)
    setLoading(false)
  }

  const toggle = (i: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const toggleAll = () => {
    if (!results) return
    setSelected(selected.size === results.length ? new Set() : new Set(results.map((_, i) => i)))
  }

  const addSelected = async () => {
    if (!results) return
    setAdding(true)
    await Promise.allSettled(
      [...selected].map(i => api.jobs.create({
        company:  results[i].company,
        position: results[i].position,
        status:   'Not Applied',
      }))
    )
    setAdding(false)
    setDone(true)
    setResults(null)
  }

  return (
    <div className="space-y-6">
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
        Scrape LinkedIn
      </h1>

      <div className="bg-white rounded-2xl p-8 space-y-6" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Job title</label>
              <input style={inputStyle} value={search} onChange={e => setSearch(e.target.value)}
                onFocus={e => {
                  e.target.style.borderColor = '#94a3b8'
                  e.target.style.background = 'white'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#cbd5e1'
                  e.target.style.background = '#fafbfc'
                }} />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)}
                onFocus={e => {
                  e.target.style.borderColor = '#94a3b8'
                  e.target.style.background = 'white'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#cbd5e1'
                  e.target.style.background = '#fafbfc'
                }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Company filter (optional)</label>
            <input style={inputStyle} value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} placeholder="Leave blank to show all companies"
              onFocus={e => {
                e.target.style.borderColor = '#94a3b8'
                e.target.style.background = 'white'
              }}
              onBlur={e => {
                e.target.style.borderColor = '#cbd5e1'
                e.target.style.background = '#fafbfc'
              }} />
          </div>
        </div>
        <button onClick={scrape} disabled={loading} className="w-full rounded-xl transition-all duration-200" style={{
          padding: '12px 16px', background: loading ? '#cbd5e1' : '#1e293b', color: 'white',
          fontSize: '0.875rem', fontWeight: 500, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.08)',
        }}>
          {loading ? 'Scraping...' : 'Search LinkedIn'}
        </button>
      </div>

      {done && <p style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 500 }}>Jobs added successfully.</p>}

      {results !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{results.length} jobs found</p>
            <button onClick={toggleAll} style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#94a3b8'}
            >
              {selected.size === results.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="space-y-1.5">
            {results.map((job, i) => (
              <label key={i} className="flex items-center gap-3 bg-white cursor-pointer transition-all" style={{
                border: selected.has(i) ? '1px solid #94a3b8' : '1px solid #e2e8f0',
                borderRadius: '10px', padding: '10px 14px',
              }}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)}
                  style={{ accentColor: '#0f172a', width: '14px', height: '14px', flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', margin: 0 }} className="truncate">
                    {job.position}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '1px 0 0' }} className="truncate">
                    {job.company}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {selected.size > 0 && (
            <button onClick={addSelected} disabled={adding} className="w-full rounded-lg transition-colors" style={{
              padding: '10px', background: adding ? '#64748b' : '#0f172a', color: 'white',
              fontSize: '0.85rem', fontWeight: 500, border: 'none', cursor: adding ? 'not-allowed' : 'pointer',
            }}>
              {adding ? 'Adding...' : `Add ${selected.size} job${selected.size > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
