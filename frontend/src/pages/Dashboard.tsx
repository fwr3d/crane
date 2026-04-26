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

  useEffect(() => {
    api.stats().then(setStats)
  }, [])

  if (!stats) return <p className="text-slate-400 text-sm">Loading...</p>

  const max = Math.max(...STATUSES.map(s => stats.by_status[s as keyof typeof stats.by_status] ?? 0), 1)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">{stats.total} jobs tracked</p>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Applied', value: stats.by_status['Applied'] },
          { label: 'Interviews', value: stats.by_status['Interview'] },
          { label: 'Offers', value: stats.by_status['Offer'] },
        ].map(m => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{m.label}</p>
            <p className="text-3xl font-semibold text-slate-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <p className="text-sm font-semibold text-slate-700 mb-6">Pipeline</p>
        <div className="space-y-3">
          {STATUSES.map(s => {
            const count = stats.by_status[s as keyof typeof stats.by_status] ?? 0
            const pct = (count / max) * 100
            return (
              <div key={s} className="flex items-center gap-4">
                <span className="text-xs text-slate-500 w-24 shrink-0">{s}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: barColors[s] }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700 w-4 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rate cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Response rate</p>
            <p className="text-3xl font-semibold text-slate-900 mt-1">{stats.response_rate}%</p>
            <p className="text-xs text-slate-400 mt-1">of applications got a reply</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Offer rate</p>
            <p className="text-3xl font-semibold text-slate-900 mt-1">{stats.offer_rate}%</p>
            <p className="text-xs text-slate-400 mt-1">of active applications led to an offer</p>
          </div>
        </div>
      )}
    </div>
  )
}
