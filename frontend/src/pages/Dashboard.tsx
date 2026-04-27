import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Job, Status } from '../types'
import { CompanyLogo } from '../components/CompanyLogo'
import { StatusDot, StatusPill } from '../components/StatusBadge'
import { STATUS_LIST, statusTokens } from '../components/statusTokens'
import { useAuth } from '../context/auth'
import { linkedinJobsUrl } from '../utils/companyDomain'

type QueueItem = {
  job: Job
  kind: 'deadline' | 'follow' | 'apply'
  label: string | null
  urgency: number
  action: 'Apply' | 'Ping'
}

function daysSince(date: string | undefined, now: number): number | null {
  if (!date) return null
  return Math.floor((now - new Date(date).getTime()) / 86400000)
}

function daysUntil(date: string | undefined, now: number): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - now) / 86400000)
}

function greeting(now: Date) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function buildQueue(jobs: Job[], now: number): QueueItem[] {
  const seen = new Set<string>()
  const items: QueueItem[] = []

  for (const job of jobs) {
    const due = daysUntil(job.deadline, now)
    if (due === null || due > 3 || job.status === 'Rejected') continue

    seen.add(job.id)
    items.push({
      job,
      kind: 'deadline',
      label: due < 0 ? `Deadline passed ${Math.abs(due)}d ago` : due === 0 ? 'Deadline today' : `Deadline in ${due}d`,
      urgency: due < 0 ? 300 + Math.abs(due) : due === 0 ? 250 : 200 - due,
      action: 'Apply',
    })
  }

  for (const job of jobs) {
    if (!['Applied', 'Interview'].includes(job.status)) continue
    const quiet = daysSince(job.date_applied ?? job.date_added, now)
    if (quiet === null || quiet < 14 || seen.has(job.id)) continue

    seen.add(job.id)
    items.push({
      job,
      kind: 'follow',
      label: `Follow up - ${quiet}d quiet`,
      urgency: 100 + quiet,
      action: 'Ping',
    })
  }

  for (const job of jobs) {
    if (job.status !== 'Not Applied' || seen.has(job.id)) continue
    seen.add(job.id)
    items.push({
      job,
      kind: 'apply',
      label: null,
      urgency: 0,
      action: 'Apply',
    })
  }

  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 6)
}

function BigStat({ label, value, sub, accent = false }: { label: string; value: string | number; sub: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'var(--ink-900)' : 'var(--card)',
      color: accent ? 'white' : 'var(--ink-900)',
      border: accent ? 'none' : '1px solid var(--ink-150)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      boxShadow: accent ? 'none' : 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 10.5, color: accent ? '#94a3b8' : 'var(--ink-400)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 10 }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: accent ? '#94a3b8' : 'var(--ink-400)', marginTop: 6 }}>
        {sub}
      </div>
    </div>
  )
}

export function Dashboard({ goJobs }: { goJobs: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [linkedinUrls, setLinkedinUrls] = useState<Map<string, string>>(new Map())
  const [now] = useState(() => Date.now())
  const { profile } = useAuth()

  const load = () => {
    api.jobs.list()
      .then(setJobs)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (jobs.length === 0) return
    Promise.all(jobs.map(async job => [job.id, await linkedinJobsUrl(job.company, job.position, job.url)] as const))
      .then(entries => setLinkedinUrls(new Map(entries)))
  }, [jobs])

  const stats = useMemo(() => {
    const by = Object.fromEntries(STATUS_LIST.map(status => [status, 0])) as Record<Status, number>
    for (const job of jobs) by[job.status] = (by[job.status] ?? 0) + 1

    const applied = by.Applied + by.Interview + by.Offer + by.Rejected
    const replied = by.Interview + by.Offer + by.Rejected
    const responseRate = applied ? Math.round((replied / applied) * 100) : 0
    const inFlight = by.Applied + by.Interview
    const stale = jobs.filter(job => {
      if (!['Applied', 'Interview'].includes(job.status)) return false
      const quiet = daysSince(job.date_applied ?? job.date_added, now)
      return quiet !== null && quiet >= 14
    }).length

    return { by, total: jobs.length, responseRate, inFlight, stale }
  }, [jobs, now])

  const queue = useMemo(() => buildQueue(jobs, now), [jobs, now])

  const recent = useMemo(() =>
    [...jobs].sort((a, b) => (b.date_added ?? '').localeCompare(a.date_added ?? '')).slice(0, 5),
  [jobs])

  const weeks = useMemo(() => {
    const buckets = Array(8).fill(0) as number[]
    for (const job of jobs) {
      const ref = job.date_applied ?? job.date_added
      if (!ref) continue
      const week = Math.floor((now - new Date(ref).getTime()) / (7 * 86400000))
      if (week >= 0 && week < buckets.length) buckets[week]++
    }
    return buckets.reverse()
  }, [jobs, now])

  const updateStatus = async (id: string, status: Status) => {
    const previous = jobs
    setJobs(current => current.map(job => job.id === id ? { ...job, status } : job))
    try {
      await api.jobs.update(id, { status })
    } catch {
      setJobs(previous)
    }
  }

  if (loading) {
    return (
      <div className="fadeUp" style={{ maxWidth: 1080 }}>
        <div className="animate-pulse" style={{ display: 'grid', gap: 24 }}>
          <div style={{ height: 78, width: 360, background: 'var(--ink-100)', borderRadius: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 126, background: 'var(--ink-100)', borderRadius: 14 }} />)}
          </div>
        </div>
      </div>
    )
  }

  const date = new Date(now)
  const firstName = profile?.name?.split(/\s+/)[0]
  const maxWeek = Math.max(...weeks, 1)

  return (
    <div className="fadeUp" style={{ maxWidth: 1080 }}>
      <header style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11.5, color: 'var(--ink-400)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <h1 className="display" style={{ fontSize: 28, margin: 0 }}>
          {greeting(date)}{firstName ? `, ${firstName}.` : '.'}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-500)', margin: '10px 0 0', maxWidth: 620, lineHeight: 1.55 }}>
          You have <strong style={{ color: 'var(--ink-800)', fontWeight: 700 }}>{queue.length} things</strong> needing attention and{' '}
          <strong style={{ color: 'var(--ink-800)', fontWeight: 700 }}>{stats.by.Interview} active interviews</strong> in flight.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 12, marginBottom: 32 }}>
        <BigStat label="In flight" value={stats.inFlight} sub={`${stats.by.Interview} interviewing`} accent />
        <BigStat label="Offers" value={stats.by.Offer} sub="open" />
        <BigStat label="Response" value={`${stats.responseRate}%`} sub="reply rate" />
        <BigStat label="Queue" value={stats.by['Not Applied']} sub="to apply" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'start' }}>
        <section style={{ background: 'var(--card)', border: '1px solid var(--ink-150)', borderRadius: 'var(--radius-lg)', padding: 22, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.015em', color: 'var(--ink-900)' }}>
              Today's queue
            </h2>
            <button
              onClick={goJobs}
              style={{ fontSize: 12, color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={event => (event.currentTarget.style.color = 'var(--ink-800)')}
              onMouseLeave={event => (event.currentTarget.style.color = 'var(--ink-400)')}
            >
              See all →
            </button>
          </div>

          {queue.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>
              Nothing urgent. Nice work.
            </div>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {queue.map((item, index) => (
                <li key={`${item.job.id}-${item.kind}`} style={{
                  display: 'grid',
                  gridTemplateColumns: '24px minmax(0, 1fr) auto auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 8px',
                  borderTop: index === 0 ? 'none' : '1px solid var(--ink-100)',
                }}>
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--ink-300)', fontWeight: 700 }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.job.position}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.job.company}</span>
                      {item.label && (
                        <>
                          <span style={{ color: 'var(--ink-200)' }}>·</span>
                          <span style={{
                            color: item.urgency >= 300 ? 'var(--danger)' : item.urgency >= 100 ? 'var(--warn)' : 'var(--ink-500)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {item.label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusPill status={item.job.status} onChange={status => updateStatus(item.job.id, status)} />
                  <a
                    href={linkedinUrls.get(item.job.id) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--ink-150)',
                      background: 'white',
                      color: 'var(--ink-700)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.action}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--ink-900)', color: 'white', borderRadius: 'var(--radius-lg)', padding: 22 }}>
            <div style={{ fontSize: 10.5, color: '#64748b', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
              Momentum
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <div className="tabular" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {weeks[weeks.length - 1]}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>this week</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 18, height: 50 }}>
              {weeks.map((value, index) => {
                const isLast = index === weeks.length - 1
                return (
                  <div
                    key={index}
                    title={`${value} jobs`}
                    style={{
                      flex: 1,
                      height: `${(value / maxWeek) * 100}%`,
                      minHeight: 2,
                      background: isLast ? 'var(--accent)' : 'rgba(255,255,255,0.18)',
                      borderRadius: 2,
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#475569' }}>
              <span>8w ago</span>
              <span>now</span>
            </div>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--ink-150)', borderRadius: 'var(--radius-lg)', padding: 22, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink-400)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
              Pipeline
            </div>
            <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', marginBottom: 14, background: 'var(--ink-100)' }}>
              {STATUS_LIST.map(status => {
                const value = stats.by[status] || 0
                const pct = stats.total > 0 ? (value / stats.total) * 100 : 0
                return <div key={status} style={{ width: `${pct}%`, background: statusTokens[status].dot }} title={`${status}: ${value}`} />
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STATUS_LIST.map(status => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <StatusDot status={status} size={6} />
                  <span style={{ flex: 1, color: 'var(--ink-700)' }}>{status}</span>
                  <span className="tabular" style={{ color: 'var(--ink-400)', fontWeight: 700 }}>{stats.by[status] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {recent.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', letterSpacing: '-0.015em', color: 'var(--ink-900)' }}>
            Recently added
          </h2>
          <div style={{ background: 'var(--card)', border: '1px solid var(--ink-150)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {recent.map((job, index) => {
              const age = daysSince(job.date_added, now)
              return (
                <div key={job.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 18px',
                  borderTop: index === 0 ? 'none' : '1px solid var(--ink-100)',
                }}>
                  <CompanyLogo company={job.company} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.position}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 1 }}>
                      {job.company}{age !== null ? ` · added ${age === 0 ? 'today' : `${age}d ago`}` : ''}
                    </div>
                  </div>
                  <StatusPill status={job.status} onChange={status => updateStatus(job.id, status)} />
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
