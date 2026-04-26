import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Job, Status } from '../types'
import { StatusBadge } from '../components/StatusBadge'

const STATUSES: Status[] = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

const statusBorder: Record<string, string> = {
  'Not Applied': '#cbd5e1',
  'Applied':     '#3b82f6',
  'Interview':   '#f59e0b',
  'Offer':       '#10b981',
  'Rejected':    '#ef4444',
}

function normalizeStatus(s: string): Status {
  return (STATUSES.find(k => k.toLowerCase() === s.toLowerCase()) ?? s) as Status
}

export function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set(STATUSES))
  const [sort, setSort] = useState('date_desc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<Status>('Not Applied')

  const load = () =>
    api.jobs.list({ search, status: [...statusFilter].join(','), sort }).then(setJobs)

  useEffect(() => { load() }, [search, statusFilter, sort])

  const toggleStatus = (s: Status) =>
    setStatusFilter(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })

  const saveEdit = async (id: string) => {
    await api.jobs.update(id, editStatus)
    setEditingId(null)
    load()
  }

  const remove = async (id: string) => {
    await api.jobs.delete(id)
    load()
  }

  return (
    <div className="space-y-6">
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>All Jobs</h1>

      {/* Filters row */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white"
          style={{ border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
          placeholder="Search company or position..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => (e.target.style.borderColor = '#94a3b8')}
          onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
        />
        <select
          className="rounded-lg px-3 py-2 bg-white outline-none transition-colors"
          style={{ border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569' }}
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="date_desc">Date added</option>
          <option value="company">Company A–Z</option>
          <option value="status">Status</option>
        </select>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className="transition-all"
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              padding: '3px 12px',
              borderRadius: 999,
              cursor: 'pointer',
              border: statusFilter.has(s) ? '1px solid #0f172a' : '1px solid #e2e8f0',
              background: statusFilter.has(s) ? '#0f172a' : 'white',
              color: statusFilter.has(s) ? 'white' : '#94a3b8',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{jobs.length} jobs</p>

      {/* Job list */}
      <div className="space-y-1.5">
        {jobs.map(job => {
          const ns = normalizeStatus(job.status)
          const borderColor = statusBorder[ns] ?? '#cbd5e1'
          const isEditing = editingId === job.id

          return (
            <div
              key={job.id}
              className="bg-white transition-all"
              style={{
                border: '1px solid #e2e8f0',
                borderLeft: `3px solid ${borderColor}`,
                borderRadius: '10px',
                padding: isEditing ? '12px 16px' : '11px 16px',
              }}
            >
              {isEditing ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }} className="truncate">{job.position}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }} className="truncate">{job.company}</p>
                  </div>
                  <select
                    className="rounded-lg px-2 py-1.5 bg-white outline-none"
                    style={{ border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569' }}
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as Status)}
                  >
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={() => saveEdit(job.id)}
                    className="rounded-lg transition-colors"
                    style={{ padding: '5px 14px', background: '#0f172a', color: 'white', fontSize: '0.78rem', fontWeight: 500, border: 'none', cursor: 'pointer' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg transition-colors"
                    style={{ padding: '5px 14px', background: 'white', color: '#64748b', fontSize: '0.78rem', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }} className="truncate">{job.position}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '1px' }} className="truncate">{job.company}</p>
                  </div>
                  <StatusBadge status={ns} />
                  {job.date_added && (
                    <span className="hidden sm:block shrink-0" style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                      {job.date_added}
                    </span>
                  )}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => { setEditingId(job.id); setEditStatus(ns) }}
                      style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'}
                      onMouseLeave={e => (e.target as HTMLElement).style.color = '#94a3b8'}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(job.id)}
                      style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.target as HTMLElement).style.color = '#ef4444'}
                      onMouseLeave={e => (e.target as HTMLElement).style.color = '#cbd5e1'}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {jobs.length === 0 && (
          <div className="text-center py-16">
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>No jobs found.</p>
          </div>
        )}
      </div>
    </div>
  )
}
