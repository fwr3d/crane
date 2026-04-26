import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Stats } from '../types'

const STATUSES = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

const barColors: Record<string, string> = {
  'Not Applied': '#94a3b8',
  'Applied':     '#3b82f6',
  'Interview':   '#f59e0b',
  'Offer':       '#10b981',
  'Rejected':    '#ef4444',
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => { api.stats().then(setStats) }, [])

  if (!stats) return (
    <div className="space-y-8 animate-pulse">
      <div className="h-6 w-32 bg-slate-200 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
      </div>
    </div>
  )

  const max = Math.max(...STATUSES.map(s => stats.by_status[s as keyof typeof stats.by_status] ?? 0), 1)

  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">{stats.total} jobs tracked</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: stats.total },
          { label: 'Applied',    value: stats.by_status['Applied'] },
          { label: 'Interviews', value: stats.by_status['Interview'] },
          { label: 'Offers',     value: stats.by_status['Offer'] },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl p-5" style={{ border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 500, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {m.label}
            </p>
            <p className="tabular-nums mt-1.5" style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.4rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #e2e8f0' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '1.25rem', letterSpacing: '0.02em' }}>
          Pipeline
        </p>
        <div className="space-y-3.5">
          {STATUSES.map(s => {
            const count = stats.by_status[s as keyof typeof stats.by_status] ?? 0
            const pct = (count / max) * 100
            return (
              <div key={s} className="flex items-center gap-4">
                <span style={{ fontSize: '0.75rem', color: '#64748b', width: '80px', flexShrink: 0 }}>{s}</span>
                <div className="flex-1 rounded-full" style={{ background: '#f1f5f9', height: '6px' }}>
                  <div
                    className="rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: barColors[s], height: '6px' }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#475569', width: '16px', textAlign: 'right' }}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rates */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Response rate', value: `${stats.response_rate}%`, sub: 'of applications got a reply' },
            { label: 'Offer rate',    value: `${stats.offer_rate}%`,    sub: 'of active applications' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-2xl p-5" style={{ border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 500, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {m.label}
              </p>
              <p className="tabular-nums mt-1.5" style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.4rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                {m.value}
              </p>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px' }}>{m.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
