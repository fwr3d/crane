import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { Job, Status } from '../types'
import { CompanyLogo } from '../components/CompanyLogo'
import { STATUS_LIST, statusTokens } from '../components/statusTokens'
import { StatusDot } from '../components/StatusBadge'
import { linkedinJobsUrl } from '../utils/companyDomain'
import { useIsMobile } from '../hooks/useIsMobile'


function inferJobType(position: string): string {
  const p = position.toLowerCase()
  if (/\bintern(ship)?\b/.test(p)) return 'Internship'
  if (/\bcontract(or)?\b|\bfreelance\b/.test(p)) return 'Contract'
  if (/\bpart[\s-]?time\b/.test(p)) return 'Part-time'
  if (/\btemp(orary)?\b/.test(p)) return 'Temporary'
  return ''
}

function daysSince(date: string | undefined, now: number): number | null {
  if (!date) return null
  return Math.floor((now - new Date(date).getTime()) / 86400000)
}

function parseTags(value: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of value.split(',')) {
    const tag = part.trim().toLowerCase()
    if (tag && !seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
  }
  return tags
}

function tagText(tags: string[] | undefined): string {
  return (tags ?? []).join(', ')
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--ink-150)',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: '0.82rem',
  outline: 'none',
  color: 'var(--ink-800)',
  background: 'var(--control)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--ink-400)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 5,
}

export function Jobs({ goScrape, onStatusChange, onDeadlineSet }: { goScrape: () => void; onStatusChange?: () => void; onDeadlineSet?: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [editFields, setEditFields] = useState<Partial<Job>>({})
  const [saving, setSaving] = useState(false)
  const [addingToColumn, setAddingToColumn] = useState<Status | null>(null)
  const [newCompany, setNewCompany] = useState('')
  const [newPosition, setNewPosition] = useState('')
  const [adding, setAdding] = useState(false)
  const [linkedinUrls, setLinkedinUrls] = useState<Map<string, string>>(new Map())
  const [now] = useState(() => Date.now())
  const addCompanyRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    return Promise.resolve().then(() => api.jobs.list()).then(data => {
      setError('')
      setJobs(data)
    }).catch(error => {
      setError(error instanceof Error ? error.message : 'Could not load jobs.')
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const missing = jobs.filter(job => !job.url)
    if (missing.length === 0) return
    Promise.all(missing.map(async job => [job.id, await linkedinJobsUrl(job.company, job.position)] as const))
      .then(entries => setLinkedinUrls(new Map(entries)))
  }, [jobs])

  useEffect(() => {
    if (addingToColumn) setTimeout(() => addCompanyRef.current?.focus(), 30)
  }, [addingToColumn])

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return jobs.filter(job => {
      const tags = job.tags ?? []
      const matchesSearch = !q || `${job.company} ${job.position} ${tags.join(' ')}`.toLowerCase().includes(q)
      const matchesTag = !tagFilter || tags.includes(tagFilter)
      return matchesSearch && matchesTag
    })
  }, [jobs, search, tagFilter])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const job of jobs) {
      for (const tag of job.tags ?? []) tags.add(tag)
    }
    return [...tags].sort((a, b) => a.localeCompare(b))
  }, [jobs])

  const boardStats = useMemo(() => {
    const by = Object.fromEntries(STATUS_LIST.map(s => [s, 0])) as Record<Status, number>
    for (const job of jobs) by[job.status] = (by[job.status] ?? 0) + 1
    const active = by.Applied + by.Interview + by.Offer + by.Rejected
    const replied = by.Interview + by.Offer + by.Rejected
    return { by, total: jobs.length, responseRate: active ? Math.round((replied / active) * 100) : null }
  }, [jobs])

  const updateStatus = async (id: string, status: Status) => {
    const prev = jobs
    const existing = jobs.find(j => j.id === id)
    const dateApplied = status === 'Applied' && !existing?.date_applied
      ? new Date().toISOString().slice(0, 10)
      : undefined
    setJobs(current => current.map(j => j.id === id ? { ...j, status, ...(dateApplied ? { date_applied: dateApplied } : {}) } : j))
    setSelectedJob(current => current?.id === id ? { ...current, status, ...(dateApplied ? { date_applied: dateApplied } : {}) } : current)
    try {
      await api.jobs.update(id, { status, ...(dateApplied ? { date_applied: dateApplied } : {}) })
      onStatusChange?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update status.')
      setJobs(prev)
    }
  }

  const openDetail = (job: Job) => {
    setSelectedJob(job)
    setEditFields({
      status: job.status,
      url: job.url ?? '',
      location: job.location ?? '',
      salary: job.salary ?? '',
      job_type: job.job_type || inferJobType(job.position),
      source: job.source ?? '',
      job_id: job.job_id ?? '',
      logo_url: job.logo_url ?? '',
      tags: job.tags ?? [],
      notes: job.notes ?? '',
      deadline: job.deadline ?? '',
    })
  }

  const save = async () => {
    if (!selectedJob) return
    setSaving(true)
    setError('')
    try {
      await api.jobs.update(selectedJob.id, {
        status: editFields.status,
        url: editFields.url,
        location: editFields.location,
        salary: editFields.salary,
        job_type: editFields.job_type,
        tags: editFields.tags,
        source: editFields.source,
        job_id: editFields.job_id,
        logo_url: editFields.logo_url,
        notes: editFields.notes,
        deadline: editFields.deadline,
      })
      if (editFields.deadline) onDeadlineSet?.()
      setSelectedJob(null)
      load()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save job.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setSaving(true)
    setError('')
    try {
      await api.jobs.delete(id)
      setSelectedJob(null)
      load()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete job.')
    } finally {
      setSaving(false)
    }
  }

  const handleDrop = (status: Status) => {
    if (!draggingId) return
    setDragOverColumn(null)
    updateStatus(draggingId, status)
    setDraggingId(null)
  }

  const startAdding = (status: Status) => {
    setAddingToColumn(status)
    setNewCompany('')
    setNewPosition('')
  }

  const cancelAdding = () => {
    setAddingToColumn(null)
    setNewCompany('')
    setNewPosition('')
  }

  const addJob = async (status: Status) => {
    const company = newCompany.trim()
    const position = newPosition.trim()
    if (!company || !position) return
    setAdding(true)
    setError('')
    try {
      await api.jobs.create({ company, position, status })
      cancelAdding()
      load()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not add job.')
    } finally {
      setAdding(false)
    }
  }

  const isEmpty = !loading && jobs.length === 0
  const isMobile = useIsMobile()

  return (
    <div className="fadeUp" style={isMobile ? { display: 'flex', flexDirection: 'column' } : { height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 260px' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-300)', fontSize: 13, pointerEvents: 'none' }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{
              width: '100%', height: 34, padding: '0 12px 0 34px', borderRadius: 8,
              border: '1px solid var(--ink-150)', background: 'var(--card)', fontSize: 13,
              color: 'var(--ink-800)', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--ink-400)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--ink-150)')}
          />
        </div>

        {boardStats.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {STATUS_LIST.map(status => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <StatusDot status={status} size={6} />
                <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>{status}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)' }}>{boardStats.by[status]}</span>
              </div>
            ))}
            {boardStats.responseRate !== null && (
              <>
                <span style={{ color: 'var(--ink-150)', fontSize: 12 }}>|</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>
                  response <span style={{ fontWeight: 700, color: 'var(--ink-700)' }}>{boardStats.responseRate}%</span>
                </span>
              </>
            )}
          </div>
        )}

        {allTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', width: '100%' }}>
            <button
              onClick={() => setTagFilter('')}
              style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: '4px 9px', border: '1px solid var(--ink-150)', background: !tagFilter ? 'var(--action)' : 'var(--control)', color: !tagFilter ? 'var(--action-text)' : 'var(--ink-500)', cursor: 'pointer' }}
            >
              All tags
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(current => current === tag ? '' : tag)}
                style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: '4px 9px', border: '1px solid var(--accent-line)', background: tagFilter === tag ? 'var(--accent)' : 'var(--accent-bg)', color: tagFilter === tag ? 'var(--action-text)' : 'var(--accent)', cursor: 'pointer' }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </header>

      {error && (
        <div style={{ marginBottom: 12, border: '1px solid var(--danger-line)', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, padding: '9px 11px', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-400)', fontSize: 13 }}>
          Loading jobs...
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-800)', margin: 0, letterSpacing: '-0.02em' }}>No jobs yet</p>
          <p style={{ fontSize: 14, color: 'var(--ink-400)', margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
            Add jobs you want to apply to, or scrape LinkedIn to find new ones.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              data-tutorial-id="add-job-btn"
              onClick={() => startAdding('Not Applied')}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: 'var(--action)', color: 'var(--action-text)', border: 'none', cursor: 'pointer' }}
            >
              + Add a job
            </button>
            <button
              onClick={goScrape}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: 'var(--control)', color: 'var(--ink-700)', border: '1px solid var(--ink-150)', cursor: 'pointer' }}
            >
              Scrape LinkedIn
            </button>
          </div>
        </div>
      ) : !loading && (
        /* Kanban columns */
        <div style={isMobile ? {
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        } : {
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))',
          gap: 10,
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
        }}>
          {STATUS_LIST.map(status => {
            const token = statusTokens[status]
            const columnJobs = filteredJobs.filter(j => j.status === status)
            const isOver = dragOverColumn === status
            const isAdding = addingToColumn === status

            return (
              <div
                key={status}
                onDragOver={e => { e.preventDefault(); setDragOverColumn(status) }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null)
                }}
                onDrop={() => handleDrop(status)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: isOver ? 'var(--surface-muted)' : 'var(--ink-50)',
                  borderRadius: 12,
                  border: `2px solid ${isOver ? token.dot : 'transparent'}`,
                  transition: 'border-color 0.1s, background 0.1s',
                }}
              >
                {/* Column header */}
                <div style={{ padding: '10px 10px 6px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: token.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-600)', letterSpacing: '0.05em', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-400)', background: 'var(--control)', borderRadius: 999, padding: '1px 6px', flexShrink: 0 }}>
                    {columnJobs.length}
                  </span>
                  <button
                    onClick={() => isAdding ? cancelAdding() : startAdding(status)}
                    title="Add job here"
                    style={{
                      width: 20, height: 20, borderRadius: 5, border: 'none',
                      background: isAdding ? 'var(--ink-200)' : 'transparent',
                      color: isAdding ? 'var(--ink-600)' : 'var(--ink-400)',
                      fontSize: 14, lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                    onMouseEnter={e => { if (!isAdding) e.currentTarget.style.background = 'var(--ink-200)' }}
                    onMouseLeave={e => { if (!isAdding) e.currentTarget.style.background = 'transparent' }}
                  >
                    {isAdding ? '×' : '+'}
                  </button>
                </div>

                {/* Inline add form */}
                {isAdding && (
                  <div style={{ margin: '0 8px 6px', background: 'var(--card)', borderRadius: 9, border: '1px solid var(--ink-300)', padding: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      ref={addCompanyRef}
                      placeholder="Company"
                      value={newCompany}
                      onChange={e => setNewCompany(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && cancelAdding()}
                      style={{ ...fieldStyle, padding: '5px 8px', fontSize: '0.8rem' }}
                    />
                    <input
                      placeholder="Role"
                      value={newPosition}
                      onChange={e => setNewPosition(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addJob(status)
                        if (e.key === 'Escape') cancelAdding()
                      }}
                      style={{ ...fieldStyle, padding: '5px 8px', fontSize: '0.8rem' }}
                    />
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        onClick={() => addJob(status)}
                        disabled={adding || !newCompany.trim() || !newPosition.trim()}
                        style={{
                          flex: 1, fontSize: 11.5, fontWeight: 700, padding: '5px 0',
                          borderRadius: 6, background: 'var(--action)', color: 'var(--action-text)',
                          border: 'none', cursor: adding ? 'not-allowed' : 'pointer', opacity: (!newCompany.trim() || !newPosition.trim()) ? 0.4 : 1,
                        }}
                      >
                        {adding ? '...' : 'Add'}
                      </button>
                      <button
                        onClick={cancelAdding}
                        style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--ink-150)', background: 'var(--control)', color: 'var(--ink-600)', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Cards */}
                <div style={{
                  flex: 1, overflowY: isMobile ? 'visible' : 'auto', padding: '0 8px 8px',
                  display: 'flex', flexDirection: 'column', gap: 5,
                }}>
                  {columnJobs.map(job => {
                    const quiet = daysSince(job.date_applied ?? job.date_added, now)
                    const age = daysSince(job.date_added, now)
                    const stale = ['Applied', 'Interview'].includes(job.status) && quiet !== null && quiet >= 14
                    const isDragging = draggingId === job.id

                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={() => setDraggingId(job.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverColumn(null) }}
                        onClick={() => openDetail(job)}
                        style={{
                          background: 'var(--card)', borderRadius: 9, border: '1px solid var(--ink-150)',
                          padding: '9px 10px', cursor: 'grab', opacity: isDragging ? 0.35 : 1,
                          transition: 'opacity 0.1s, box-shadow 0.1s', userSelect: 'none',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <CompanyLogo company={job.company} logoUrl={job.logo_url} size={24} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {job.position}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--ink-400)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {job.company}
                            </p>
                          </div>
                        </div>
                        {(age !== null || stale || job.notes?.trim() || (job.tags?.length ?? 0) > 0) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                            {age !== null && (
                              <span style={{ fontSize: 10, color: 'var(--ink-300)' }}>
                                {age === 0 ? 'today' : `${age}d`}
                              </span>
                            )}
                            {stale && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-line)', padding: '1px 5px', borderRadius: 999 }}>
                                {quiet}d quiet
                              </span>
                            )}
                            {job.notes?.trim() && (
                              <span style={{ fontSize: 10, color: 'var(--ink-300)', marginLeft: 'auto' }}>✎</span>
                            )}
                            {(job.tags ?? []).slice(0, 3).map(tag => (
                              <span key={tag} style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-line)', padding: '1px 5px', borderRadius: 999 }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {columnJobs.length === 0 && !isAdding && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ink-200)', fontSize: 11, pointerEvents: 'none' }}>
                      {isOver ? '↓ drop here' : 'empty'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedJob && (
        <div
          onClick={() => setSelectedJob(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: 460, maxWidth: 'calc(100vw - 40px)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <CompanyLogo company={selectedJob.company} logoUrl={selectedJob.logo_url} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{selectedJob.position}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink-500)' }}>{selectedJob.company}</p>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ fontSize: 20, lineHeight: 1, color: 'var(--ink-300)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  data-tutorial-id="status-pill"
                  value={editFields.status}
                  onChange={e => {
                    const status = e.target.value as Status
                    setEditFields(f => ({ ...f, status }))
                    updateStatus(selectedJob.id, status)
                  }}
                  style={fieldStyle}
                >
                  {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Deadline</label>
                <input data-tutorial-id="deadline-field" type="date" value={editFields.deadline ?? ''} onChange={e => setEditFields(f => ({ ...f, deadline: e.target.value }))} style={fieldStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Location</label>
                <input value={editFields.location ?? ''} onChange={e => setEditFields(f => ({ ...f, location: e.target.value }))} placeholder="New York, NY" style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Job type</label>
                <input value={editFields.job_type ?? ''} onChange={e => setEditFields(f => ({ ...f, job_type: e.target.value }))} placeholder="Internship, full-time..." style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Salary</label>
                <input value={editFields.salary ?? ''} onChange={e => setEditFields(f => ({ ...f, salary: e.target.value }))} placeholder="$90k - $120k" style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Source</label>
                <input value={editFields.source ?? ''} onChange={e => setEditFields(f => ({ ...f, source: e.target.value }))} placeholder="LinkedIn" style={fieldStyle} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Job URL</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {editFields.url && (
                    <a href={editFields.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--applied)', textDecoration: 'none' }}>
                      Open ↗
                    </a>
                  )}
                  {!editFields.url && linkedinUrls.get(selectedJob.id) && (
                    <a href={linkedinUrls.get(selectedJob.id)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>
                      Search LinkedIn ↗
                    </a>
                  )}
                </div>
              </div>
              <input type="url" placeholder="https://..." value={editFields.url ?? ''} onChange={e => setEditFields(f => ({ ...f, url: e.target.value }))} style={fieldStyle} />
            </div>

            <div>
              <label style={labelStyle}>LinkedIn job ID</label>
              <input placeholder="4398329491" value={editFields.job_id ?? ''} onChange={e => setEditFields(f => ({ ...f, job_id: e.target.value }))} style={fieldStyle} />
            </div>

            <div>
              <label style={labelStyle}>Tags</label>
              <input placeholder="remote, frontend, referral" value={tagText(editFields.tags)} onChange={e => setEditFields(f => ({ ...f, tags: parseTags(e.target.value) }))} style={fieldStyle} />
            </div>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea rows={3} placeholder="Interview prep, contacts, salary..." value={editFields.notes ?? ''} onChange={e => setEditFields(f => ({ ...f, notes: e.target.value }))} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => remove(selectedJob.id)}
                style={{ fontSize: 12, color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-400)')}
              >
                Delete
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelectedJob(null)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--ink-150)', background: 'var(--control)', color: 'var(--ink-700)', cursor: 'pointer' }}>
                  Close
                </button>
                <button onClick={save} disabled={saving} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, background: 'var(--action)', color: 'var(--action-text)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
