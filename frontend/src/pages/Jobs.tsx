import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Job, Status } from '../types'
import { CompanyLogo } from '../components/CompanyLogo'
import { STATUS_LIST, statusTokens } from '../components/statusTokens'
import { StatusDot, StatusPill } from '../components/StatusBadge'
import { linkedinJobsUrl } from '../utils/companyDomain'

type FocusFilter = 'all' | 'follow-up' | 'deadline-soon' | 'overdue' | 'missing-url' | 'has-notes'

const FOCUS_FILTERS: { id: FocusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'follow-up', label: 'Needs follow-up' },
  { id: 'deadline-soon', label: 'Due soon' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'missing-url', label: 'Missing URL' },
  { id: 'has-notes', label: 'Has notes' },
]

function daysSince(date: string | undefined, now: number): number | null {
  if (!date) return null
  return Math.floor((now - new Date(date).getTime()) / 86400000)
}

function daysUntil(date: string | undefined, now: number): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - now) / 86400000)
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--ink-150)',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: '0.82rem',
  outline: 'none',
  color: 'var(--ink-800)',
  background: 'white',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--ink-400)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 5,
  display: 'block',
}

export function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set(STATUS_LIST))
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('all')
  const [sort, setSort] = useState('date_desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<Job>>({})
  const [saving, setSaving] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>('Applied')
  const [bulking, setBulking] = useState(false)
  const [linkedinUrls, setLinkedinUrls] = useState<Map<string, string>>(new Map())
  const [now] = useState(() => Date.now())

  const load = useCallback(() =>
    api.jobs.list({ search, status: [...statusFilter].join(','), sort }).then(setJobs),
  [search, statusFilter, sort])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const missing = jobs.filter(job => !job.url)
    if (missing.length === 0) return
    Promise.all(missing.map(async job => [job.id, await linkedinJobsUrl(job.company, job.position)] as const))
      .then(entries => setLinkedinUrls(new Map(entries)))
  }, [jobs])

  const visibleJobs = useMemo(() => jobs.filter(job => {
    if (focusFilter === 'all') return true
    const quiet = daysSince(job.date_applied ?? job.date_added, now)
    const due = daysUntil(job.deadline, now)

    if (focusFilter === 'follow-up') return ['Applied', 'Interview'].includes(job.status) && quiet !== null && quiet >= 14
    if (focusFilter === 'deadline-soon') return due !== null && due >= 0 && due <= 7 && job.status !== 'Rejected'
    if (focusFilter === 'overdue') return due !== null && due < 0 && job.status !== 'Rejected'
    if (focusFilter === 'missing-url') return !job.url
    if (focusFilter === 'has-notes') return Boolean(job.notes?.trim())
    return true
  }), [jobs, focusFilter, now])

  const filteredCount = visibleJobs.length
  const filtersActive = search.trim() !== '' || statusFilter.size !== STATUS_LIST.length || focusFilter !== 'all'

  const selectedVisible = useMemo(
    () => visibleJobs.filter(job => bulkSelected.has(job.id)).length,
    [visibleJobs, bulkSelected],
  )

  const toggleStatusFilter = (status: Status) =>
    setStatusFilter(previous => {
      const next = new Set(previous)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })

  const toggleBulk = (id: string) =>
    setBulkSelected(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectAll = () =>
    setBulkSelected(selectedVisible === visibleJobs.length ? new Set() : new Set(visibleJobs.map(job => job.id)))

  const resetFilters = () => {
    setSearch('')
    setStatusFilter(new Set(STATUS_LIST))
    setFocusFilter('all')
  }

  const expand = (job: Job) => {
    if (expandedId === job.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(job.id)
    setEditFields({
      status: job.status,
      url: job.url ?? '',
      notes: job.notes ?? '',
      deadline: job.deadline ?? '',
    })
  }

  const updateStatus = async (id: string, status: Status) => {
    const previous = jobs
    setJobs(current => current.map(job => job.id === id ? { ...job, status } : job))
    try {
      await api.jobs.update(id, { status })
    } catch {
      setJobs(previous)
    }
  }

  const save = async (id: string) => {
    setSaving(true)
    await api.jobs.update(id, {
      status: editFields.status,
      url: editFields.url,
      notes: editFields.notes,
      deadline: editFields.deadline,
    })
    setSaving(false)
    setExpandedId(null)
    load()
  }

  const remove = async (id: string) => {
    await api.jobs.delete(id)
    setBulkSelected(previous => {
      const next = new Set(previous)
      next.delete(id)
      return next
    })
    load()
  }

  const applyBulk = async () => {
    setBulking(true)
    await api.jobs.bulkUpdate([...bulkSelected], bulkStatus)
    setBulkSelected(new Set())
    setBulking(false)
    load()
  }

  return (
    <div className="fadeUp" style={{ maxWidth: 1280, paddingBottom: bulkSelected.size > 0 ? 86 : 0 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-400)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            Application library
          </div>
          <h1 className="display" style={{ fontSize: 28, margin: 0 }}>
            {filteredCount} <span style={{ color: 'var(--ink-300)' }}>of {jobs.length}</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {filtersActive && (
            <button
              onClick={resetFilters}
              style={{ fontSize: 12, color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={event => (event.currentTarget.style.color = 'var(--ink-800)')}
              onMouseLeave={event => (event.currentTarget.style.color = 'var(--ink-400)')}
            >
              Clear filters
            </button>
          )}
          {visibleJobs.length > 0 && (
            <button
              onClick={selectAll}
              style={{ fontSize: 12, color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={event => (event.currentTarget.style.color = 'var(--ink-800)')}
              onMouseLeave={event => (event.currentTarget.style.color = 'var(--ink-400)')}
            >
              {selectedVisible === visibleJobs.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-300)', fontSize: 13 }}>
            ⌕
          </span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search company or role..."
            style={{
              width: '100%',
              height: 36,
              padding: '0 12px 0 34px',
              borderRadius: 8,
              border: '1px solid var(--ink-150)',
              background: 'white',
              fontSize: 13,
              color: 'var(--ink-800)',
              outline: 'none',
            }}
            onFocus={event => (event.currentTarget.style.borderColor = 'var(--ink-400)')}
            onBlur={event => (event.currentTarget.style.borderColor = 'var(--ink-150)')}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--ink-100)', borderRadius: 8, flexWrap: 'wrap' }}>
          {STATUS_LIST.map(status => {
            const selected = statusFilter.has(status)
            return (
              <button
                key={status}
                onClick={() => toggleStatusFilter(status)}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: selected ? 'white' : 'transparent',
                  color: selected ? 'var(--ink-800)' : 'var(--ink-400)',
                  boxShadow: selected ? 'var(--shadow-sm)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <StatusDot status={status} size={5} />
                {status}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        <select
          value={sort}
          onChange={event => setSort(event.target.value)}
          style={{
            height: 36,
            padding: '0 28px 0 12px',
            borderRadius: 8,
            border: '1px solid var(--ink-150)',
            background: 'white',
            fontSize: 12.5,
            color: 'var(--ink-700)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="date_desc">Most recent</option>
          <option value="company">Company A-Z</option>
          <option value="status">By status</option>
          <option value="deadline">By deadline</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Focus
        </span>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--ink-100)', borderRadius: 8, flexWrap: 'wrap' }}>
          {FOCUS_FILTERS.map(filter => {
            const selected = focusFilter === filter.id
            return (
              <button
                key={filter.id}
                onClick={() => setFocusFilter(filter.id)}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: selected ? 'white' : 'transparent',
                  color: selected ? 'var(--ink-800)' : 'var(--ink-400)',
                  boxShadow: selected ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--ink-150)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {visibleJobs.map((job, index) => {
          const quiet = daysSince(job.date_applied ?? job.date_added, now)
          const age = daysSince(job.date_added, now)
          const due = daysUntil(job.deadline, now)
          const stale = ['Applied', 'Interview'].includes(job.status) && quiet !== null && quiet >= 14
          const selected = bulkSelected.has(job.id)
          const expanded = expandedId === job.id
          const url = job.url || linkedinUrls.get(job.id) || '#'
          const token = statusTokens[job.status]

          return (
            <div key={job.id} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--ink-100)', background: selected ? 'var(--ink-50)' : 'transparent' }}>
              <div
                className="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 36px minmax(0, 1fr) auto auto auto',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 18px',
                  borderLeft: `3px solid ${token.dot}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleBulk(job.id)}
                  style={{ accentColor: 'var(--ink-900)', width: 14, height: 14 }}
                />
                <CompanyLogo company={job.company} size={32} />
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => expand(job)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.position}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={event => event.stopPropagation()}
                      style={{ color: 'var(--ink-300)', display: 'inline-flex', textDecoration: 'none', flexShrink: 0 }}
                      title={job.url ? 'Open posting' : 'Find on LinkedIn'}
                    >
                      ↗
                    </a>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span style={{ color: 'var(--ink-700)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.company}</span>
                    {age !== null && (
                      <>
                        <span style={{ color: 'var(--ink-200)' }}>·</span>
                        <span className="tabular">{age === 0 ? 'today' : `${age}d old`}</span>
                      </>
                    )}
                    {job.deadline && (
                      <>
                        <span style={{ color: 'var(--ink-200)' }}>·</span>
                        <span>{new Date(job.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                  {stale && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-line)', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      {quiet}d quiet
                    </span>
                  )}
                  {due !== null && due <= 3 && job.status !== 'Rejected' && (
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: due < 0 ? 'var(--danger)' : 'var(--warn)',
                      background: due < 0 ? 'var(--danger-bg)' : 'var(--warn-bg)',
                      border: `1px solid ${due < 0 ? 'var(--danger-line)' : 'var(--warn-line)'}`,
                      padding: '2px 8px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}>
                      {due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'Due today' : `${due}d left`}
                    </span>
                  )}
                </div>

                <StatusPill status={job.status} onChange={status => updateStatus(job.id, status)} />

                <button
                  onClick={() => expand(job)}
                  aria-label={expanded ? 'Collapse job details' : 'Expand job details'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ink-300)',
                    padding: 4,
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}
                >
                  ▾
                </button>
              </div>

              {expanded && (
                <div style={{ padding: '8px 18px 18px 77px', background: 'var(--ink-50)', display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={editFields.status} onChange={event => setEditFields(fields => ({ ...fields, status: event.target.value as Status }))} style={inputStyle}>
                        {STATUS_LIST.map(status => <option key={status}>{status}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Deadline</label>
                      <input type="date" value={editFields.deadline ?? ''} onChange={event => setEditFields(fields => ({ ...fields, deadline: event.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Job URL</label>
                      <input type="url" placeholder="https://..." value={editFields.url ?? ''} onChange={event => setEditFields(fields => ({ ...fields, url: event.target.value }))} style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <label style={labelStyle}>Notes</label>
                      <a href={editFields.url || url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--applied)', textDecoration: 'none' }}>
                        {editFields.url ? 'Open posting ↗' : 'Find on LinkedIn ↗'}
                      </a>
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Interview prep, contacts, salary discussions..."
                      value={editFields.notes ?? ''}
                      onChange={event => setEditFields(fields => ({ ...fields, notes: event.target.value }))}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => remove(job.id)}
                      style={{ fontSize: 12, color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onMouseEnter={event => (event.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={event => (event.currentTarget.style.color = 'var(--ink-400)')}
                    >
                      Remove
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setExpandedId(null)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--ink-150)', background: 'white', color: 'var(--ink-700)', cursor: 'pointer' }}>
                        Close
                      </button>
                      <button onClick={() => save(job.id)} disabled={saving} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, background: 'var(--ink-900)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {visibleJobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-300)', fontSize: 14 }}>
            Nothing matches that filter.
          </div>
        )}
      </div>

      {bulkSelected.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--ink-900)',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 40,
        }}>
          <span style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 4 }}>
            {bulkSelected.size} selected
          </span>
          <span style={{ width: 1, height: 18, background: '#1e293b' }} />
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>Set status →</span>
          <select value={bulkStatus} onChange={event => setBulkStatus(event.target.value as Status)} style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, background: '#1e293b', color: 'white', border: '1px solid #334155', outline: 'none' }}>
            {STATUS_LIST.map(status => <option key={status}>{status}</option>)}
          </select>
          <button onClick={applyBulk} disabled={bulking} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', cursor: bulking ? 'not-allowed' : 'pointer' }}>
            {bulking ? 'Applying...' : 'Apply'}
          </button>
          <button onClick={() => setBulkSelected(new Set())} style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
