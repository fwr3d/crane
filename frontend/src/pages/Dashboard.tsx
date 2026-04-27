import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Job, Stats } from '../types'

const STATUSES = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

const barColors: Record<string, string> = {
  'Not Applied': '#94a3b8',
  'Applied':     '#3b82f6',
  'Interview':   '#f59e0b',
  'Offer':       '#10b981',
  'Rejected':    '#ef4444',
}

const statusDot: Record<string, string> = {
  'Not Applied': '#94a3b8',
  'Applied':     '#3b82f6',
  'Interview':   '#f59e0b',
  'Offer':       '#10b981',
  'Rejected':    '#ef4444',
}

type QueueItem = {
  job:      Job
  label:    string | null
  urgent:   boolean
  action:   'Apply' | 'Ping'
}

function buildQueue(jobs: Job[]): QueueItem[] {
  const today = Date.now()
  const seen  = new Set<string>()
  const items: (QueueItem & { priority: number })[] = []

  // 1. Passed deadlines
  for (const job of jobs) {
    if (!job.deadline) continue
    const days = Math.floor((today - new Date(job.deadline).getTime()) / 86400000)
    if (days > 0 && !seen.has(job.id)) {
      seen.add(job.id)
      items.push({ job, label: `Deadline passed ${days}d ago`, urgent: true, action: 'Apply', priority: 200 + days })
    }
  }

  // 2. Stale Applied / Interview
  for (const job of jobs) {
    if (!['Applied', 'Interview'].includes(job.status)) continue
    const ref  = job.date_applied ?? job.date_added
    if (!ref) continue
    const days = Math.floor((today - new Date(ref).getTime()) / 86400000)
    if (days >= 14 && !seen.has(job.id)) {
      seen.add(job.id)
      items.push({ job, label: `Follow up — ${days}d quiet`, urgent: true, action: 'Ping', priority: 100 + days })
    }
  }

  // 3. Not Applied (fill remaining slots)
  for (const job of jobs) {
    if (job.status !== 'Not Applied' || seen.has(job.id)) continue
    seen.add(job.id)
    items.push({ job, label: null, urgent: false, action: 'Apply', priority: 0 })
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 6)
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [jobs,  setJobs]  = useState<Job[]>([])

  useEffect(() => {
    api.stats().then(setStats)
    api.jobs.list().then(setJobs)
  }, [])

  if (!stats) return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
      </div>
    </div>
  )

  const queue = buildQueue(jobs)
  const inFlight = (stats.by_status['Applied'] ?? 0) + (stats.by_status['Interview'] ?? 0)
  const max = Math.max(...STATUSES.map(s => stats.by_status[s as keyof typeof stats.by_status] ?? 0), 1)

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
        </p>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          {(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.' })()}
        </h1>
        {stats.total > 0 && (
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
            You have <strong style={{ color: '#0f172a' }}>{inFlight} jobs</strong> in flight
            {stats.stale > 0 && <> and <strong style={{ color: '#b45309' }}>{stats.stale} needing follow-up</strong></>}.
          </p>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl p-5" style={{ background: '#0f172a' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>In flight</p>
          <p className="tabular-nums mt-2" style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.6rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
            {inFlight}
          </p>
          <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: '6px' }}>{stats.by_status['Interview']} interviewing</p>
        </div>

        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Offers</p>
          <p className="tabular-nums mt-2" style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.6rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
            {stats.by_status['Offer']}
          </p>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px' }}>open</p>
        </div>

        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Response</p>
          <p className="tabular-nums mt-2" style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.6rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
            {stats.response_rate}%
          </p>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px' }}>reply rate</p>
        </div>

        <div className="rounded-2xl p-5" style={{ border: `1px solid ${stats.stale > 0 ? '#fde68a' : '#e2e8f0'}`, background: stats.stale > 0 ? '#fffbeb' : 'white' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: stats.stale > 0 ? '#92400e' : '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Queue</p>
          <p className="tabular-nums mt-2" style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.6rem', fontWeight: 700, color: stats.stale > 0 ? '#b45309' : '#0f172a', lineHeight: 1 }}>
            {stats.by_status['Not Applied']}
          </p>
          <p style={{ fontSize: '0.72rem', color: stats.stale > 0 ? '#92400e' : '#94a3b8', marginTop: '6px' }}>to apply</p>
        </div>
      </div>

      {/* Two-column: queue + pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1rem', alignItems: 'start' }}>

        {/* Today's queue */}
        <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>Today's queue</p>
            <a href="#" style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'none' }}
              onClick={e => e.preventDefault()}>
              See all →
            </a>
          </div>

          {queue.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>
              Nothing urgent — you're on top of it.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {queue.map((item, i) => (
                <div key={item.job.id} style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr auto auto',
                  alignItems: 'center', gap: '12px',
                  padding: '10px 8px', borderRadius: '8px',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#cbd5e1', fontFamily: "'Syne', sans-serif" }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.job.position}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: item.urgent ? '#f59e0b' : '#94a3b8', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.job.company}{item.label ? <> · <span style={{ color: item.urgent ? '#f59e0b' : '#94a3b8' }}>{item.label}</span></> : ''}
                    </p>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px 3px 7px',
                    flexShrink: 0,
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusDot[item.job.status], flexShrink: 0 }} />
                    <span style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'nowrap' }}>{item.job.status}</span>
                  </div>

                  <a
                    href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(item.job.position + ' ' + item.job.company)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      fontSize: '0.72rem', fontWeight: 600,
                      color: '#0f172a', background: 'white',
                      border: '1px solid #e2e8f0', borderRadius: '6px',
                      padding: '5px 12px', textDecoration: 'none', flexShrink: 0,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#94a3b8')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                  >
                    {item.action}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Pipeline
          </p>

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: '6px', borderRadius: '99px', overflow: 'hidden', marginBottom: '1.25rem', gap: '2px' }}>
            {STATUSES.map(s => {
              const count = stats.by_status[s as keyof typeof stats.by_status] ?? 0
              const pct   = stats.total > 0 ? (count / stats.total) * 100 : 0
              return pct > 0 ? (
                <div key={s} style={{ width: `${pct}%`, background: barColors[s], borderRadius: '99px' }} />
              ) : null
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {STATUSES.map(s => {
              const count = stats.by_status[s as keyof typeof stats.by_status] ?? 0
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusDot[s], flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: '#475569' }}>{s}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', fontFamily: "'Syne', sans-serif" }}>{count}</span>
                </div>
              )
            })}
          </div>

          {stats.total > 0 && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Response rate</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>{stats.response_rate}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Offer rate</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>{stats.offer_rate}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
