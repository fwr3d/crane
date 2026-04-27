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

function isStale(job: Job): boolean {
  if (!['Applied', 'Interview'].includes(job.status)) return false
  const ref = job.date_applied ?? job.date_added
  if (!ref) return false
  return (Date.now() - new Date(ref).getTime()) / 86400000 > 14
}

function deadlineDays(deadline?: string): number | null {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px',
  padding: '7px 10px', fontSize: '0.82rem', outline: 'none',
  color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box',
}

export function Jobs() {
  const [jobs, setJobs]               = useState<Job[]>([])
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set(STATUSES))
  const [sort, setSort]               = useState('date_desc')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [editFields, setEditFields]   = useState<Partial<Job>>({})
  const [saving, setSaving]           = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus]   = useState<Status>('Applied')
  const [bulking, setBulking]         = useState(false)

  const load = () =>
    api.jobs.list({ search, status: [...statusFilter].join(','), sort }).then(setJobs)

  useEffect(() => { load() }, [search, statusFilter, sort])

  const toggleStatusFilter = (s: Status) =>
    setStatusFilter(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })

  const expand = (job: Job) => {
    if (expandedId === job.id) { setExpandedId(null); return }
    setExpandedId(job.id)
    setEditFields({ status: normalizeStatus(job.status), url: job.url ?? '', notes: job.notes ?? '', deadline: job.deadline ?? '' })
  }

  const save = async (id: string) => {
    setSaving(true)
    await api.jobs.update(id, editFields)
    setSaving(false)
    setExpandedId(null)
    load()
  }

  const remove = async (id: string) => {
    await api.jobs.delete(id)
    setBulkSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    load()
  }

  const toggleBulk = (id: string) =>
    setBulkSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll = () =>
    setBulkSelected(bulkSelected.size === jobs.length ? new Set() : new Set(jobs.map(j => j.id)))

  const applyBulk = async () => {
    setBulking(true)
    await api.jobs.bulkUpdate([...bulkSelected], bulkStatus)
    setBulkSelected(new Set())
    setBulking(false)
    load()
  }

  return (
    <div className="space-y-5" style={{ paddingBottom: bulkSelected.size > 0 ? '80px' : 0 }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
        All Jobs
      </h1>

      {/* Filters */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none bg-white"
          style={{ border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
          placeholder="Search company or position..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => (e.target.style.borderColor = '#94a3b8')}
          onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
        />
        <select
          className="rounded-lg px-3 py-2 bg-white outline-none"
          style={{ border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569' }}
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="date_desc">Date added</option>
          <option value="company">Company A–Z</option>
          <option value="status">Status</option>
          <option value="deadline">Deadline</option>
        </select>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => toggleStatusFilter(s)} style={{
            fontSize: '0.72rem', fontWeight: 500, padding: '3px 12px', borderRadius: 999,
            cursor: 'pointer', transition: 'all 0.15s',
            border: statusFilter.has(s) ? '1px solid #0f172a' : '1px solid #e2e8f0',
            background: statusFilter.has(s) ? '#0f172a' : 'white',
            color: statusFilter.has(s) ? 'white' : '#94a3b8',
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Count + select all */}
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{jobs.length} jobs</p>
        {jobs.length > 0 && (
          <button onClick={selectAll} style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#94a3b8'}
          >
            {bulkSelected.size === jobs.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {/* Job list */}
      <div className="space-y-1.5">
        {jobs.map(job => {
          const ns         = normalizeStatus(job.status)
          const borderColor = statusBorder[ns] ?? '#cbd5e1'
          const stale      = isStale(job)
          const ddays      = deadlineDays(job.deadline)
          const isExpanded = expandedId === job.id
          const isSelected = bulkSelected.has(job.id)

          return (
            <div key={job.id} className="bg-white transition-all" style={{
              border: isSelected ? '1px solid #94a3b8' : '1px solid #e2e8f0',
              borderLeft: `3px solid ${borderColor}`,
              borderRadius: '10px',
              overflow: 'hidden',
            }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px' }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleBulk(job.id)}
                  style={{ accentColor: '#0f172a', width: '14px', height: '14px', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', margin: 0 }} className="truncate">
                      {job.position}
                    </p>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.7rem', color: '#3b82f6', flexShrink: 0 }}
                        title="Open posting"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '1px 0 0' }} className="truncate">
                    {job.company}
                  </p>
                </div>

                {/* Indicators */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {stale && (
                    <span title="No update in 14+ days" style={{
                      fontSize: '0.65rem', fontWeight: 600, color: '#b45309',
                      background: '#fef3c7', border: '1px solid #fde68a',
                      padding: '1px 7px', borderRadius: 999,
                    }}>
                      Follow up
                    </span>
                  )}
                  {ddays !== null && ddays <= 3 && (
                    <span title={`Deadline: ${job.deadline}`} style={{
                      fontSize: '0.65rem', fontWeight: 600,
                      color: ddays < 0 ? '#b91c1c' : '#b45309',
                      background: ddays < 0 ? '#fee2e2' : '#fef3c7',
                      border: `1px solid ${ddays < 0 ? '#fecaca' : '#fde68a'}`,
                      padding: '1px 7px', borderRadius: 999,
                    }}>
                      {ddays < 0 ? 'Overdue' : ddays === 0 ? 'Due today' : `${ddays}d left`}
                    </span>
                  )}
                  <StatusBadge status={ns} />
                  {job.date_added && (
                    <span className="hidden sm:block" style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                      {job.date_added}
                    </span>
                  )}
                  <button onClick={() => expand(job)} style={{
                    fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer',
                    transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                  }}>
                    ▾
                  </button>
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px', background: '#fafafa', display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</label>
                      <select value={editFields.status} onChange={e => setEditFields(f => ({ ...f, status: e.target.value as Status }))}
                        style={{ ...inputStyle }}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Deadline</label>
                      <input type="date" value={editFields.deadline ?? ''} onChange={e => setEditFields(f => ({ ...f, deadline: e.target.value }))}
                        style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Job URL</label>
                      <a
                        href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(job.position + ' ' + job.company)}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.68rem', color: '#3b82f6', textDecoration: 'none' }}
                      >
                        Find on LinkedIn ↗
                      </a>
                    </div>
                    <input type="url" placeholder="https://..." value={editFields.url ?? ''} onChange={e => setEditFields(f => ({ ...f, url: e.target.value }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Notes</label>
                    <textarea rows={3} placeholder="Interview notes, contacts, salary info..." value={editFields.notes ?? ''}
                      onChange={e => setEditFields(f => ({ ...f, notes: e.target.value }))}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => remove(job.id)} style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.target as HTMLElement).style.color = '#ef4444'}
                      onMouseLeave={e => (e.target as HTMLElement).style.color = '#cbd5e1'}
                    >
                      Remove
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setExpandedId(null)} style={{
                        fontSize: '0.78rem', padding: '6px 14px', borderRadius: '6px',
                        background: 'white', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer',
                      }}>
                        Cancel
                      </button>
                      <button onClick={() => save(job.id)} disabled={saving} style={{
                        fontSize: '0.78rem', padding: '6px 14px', borderRadius: '6px',
                        background: '#0f172a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500,
                      }}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
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

      {/* Bulk action bar */}
      {bulkSelected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', borderRadius: '12px', padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            {bulkSelected.size} selected
          </span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as Status)} style={{
            fontSize: '0.82rem', padding: '6px 10px', borderRadius: '6px',
            background: '#1e293b', color: 'white', border: '1px solid #334155', outline: 'none',
          }}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={applyBulk} disabled={bulking} style={{
            fontSize: '0.82rem', fontWeight: 600, padding: '6px 16px', borderRadius: '6px',
            background: 'white', color: '#0f172a', border: 'none', cursor: 'pointer',
          }}>
            {bulking ? 'Updating...' : 'Update'}
          </button>
          <button onClick={() => setBulkSelected(new Set())} style={{
            fontSize: '0.78rem', color: '#475569', background: 'none', border: 'none', cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
