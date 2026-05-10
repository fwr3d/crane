import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { AdvancedStats } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

const SOURCE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  remoteok: 'RemoteOK',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  url: 'URL import',
  manual: 'Manual',
}

const SOURCE_COLOR: Record<string, string> = {
  linkedin: '#3b82f6',
  remoteok: '#22c55e',
  greenhouse: '#f59e0b',
  lever: '#a855f7',
  url: '#64748b',
  manual: '#94a3b8',
}

function labelStyle(accent?: boolean): React.CSSProperties {
  return {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: accent ? '#94a3b8' : 'var(--ink-400)',
  }
}

function Card({ children, accent, style }: { children: React.ReactNode; accent?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: accent ? 'var(--action)' : 'var(--card)',
      border: accent ? 'none' : '1px solid var(--ink-150)',
      borderRadius: 14,
      padding: '20px 22px',
      boxShadow: accent ? 'none' : 'var(--shadow-sm)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent?: boolean }) {
  return (
    <Card accent={accent}>
      <div style={labelStyle(accent)}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 8, color: accent ? 'var(--action-text)' : 'var(--ink-900)' }} className="tabular">
        {value}
      </div>
      <div style={{ fontSize: 11.5, marginTop: 6, color: accent ? '#94a3b8' : 'var(--ink-400)' }}>{sub}</div>
    </Card>
  )
}

export function Stats() {
  const isMobile = useIsMobile()
  const isNarrow = useIsMobile(520)
  const [data, setData] = useState<AdvancedStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.advancedStats().then(setData).finally(() => setLoading(false))
  }, [])

  const maxVelocity = useMemo(() => Math.max(...(data?.velocity.map(v => v.count) ?? [1]), 1), [data])
  const maxFunnel   = useMemo(() => data?.funnel[0]?.count ?? 1, [data])

  if (loading) {
    return (
      <div className="fadeUp" style={{ maxWidth: 1080 }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ height: 32, width: 200, background: 'var(--ink-100)', borderRadius: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ height: 120, background: 'var(--ink-100)', borderRadius: 14 }} />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const total = data.funnel.reduce((s, f) => s + f.count, 0)
  const applied = data.funnel.find(f => f.stage === 'Applied')?.count ?? 0
  const interview = data.funnel.find(f => f.stage === 'Interview')?.count ?? 0
  const offer = data.funnel.find(f => f.stage === 'Offer')?.count ?? 0
  const rejected = data.rejected
  const submitted = applied + interview + offer + rejected
  const responses = interview + offer + rejected
  const responseRate = submitted > 0 ? Math.round(responses / submitted * 100) : 0
  const offerRate = submitted > 0 ? Math.round(offer / submitted * 100) : 0

  return (
    <div className="fadeUp" style={{ maxWidth: 1080 }}>
      <header style={{ marginBottom: isMobile ? 20 : 32 }}>
        <h1 className="display" style={{ fontSize: isMobile ? 22 : 28, margin: 0 }}>Stats</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-400)', margin: '6px 0 0' }}>
          {total} total applications
        </p>
      </header>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Response rate" value={`${responseRate}%`} sub={`${responses} of ${submitted} submitted`} accent />
        <MetricCard label="Offer rate" value={`${offerRate}%`} sub={`${offer} of ${submitted} submitted`} />
        <MetricCard
          label="Avg response time"
          value={data.avg_response_days !== null ? `${data.avg_response_days}d` : '—'}
          sub={data.response_count > 0 ? `from ${data.response_count} responses` : 'no data yet'}
        />
        <MetricCard label="In queue" value={data.funnel.find(f => f.stage === 'Not Applied')?.count ?? 0} sub="not yet applied" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Offer conversion funnel */}
        <Card>
          <div style={{ ...labelStyle(), marginBottom: 18 }}>Conversion funnel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.funnel.map((item, i) => (
              <div key={item.stage}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>{item.stage}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    {item.rate !== null && (
                      <span style={{ fontSize: 10.5, color: 'var(--ink-400)' }}>
                        {item.rate}% of total
                      </span>
                    )}
                    <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', minWidth: 24, textAlign: 'right' }}>
                      {item.count}
                    </span>
                  </div>
                </div>
                <div style={{ height: 10, background: 'var(--ink-100)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${maxFunnel > 0 ? (item.count / maxFunnel) * 100 : 0}%`,
                    background: i === 0 ? 'var(--ink-300)' : i === 1 ? 'var(--applied)' : i === 2 ? 'var(--accent)' : 'var(--offer)',
                    borderRadius: 99,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {data.rejected > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>Rejected</span>
              <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{data.rejected}</span>
            </div>
          )}
        </Card>

        {/* Success by source */}
        <Card>
          <div style={{ ...labelStyle(), marginBottom: 18 }}>Success by source</div>
          {data.by_source.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-300)', margin: 0 }}>No source data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.by_source.map(src => {
                const color = SOURCE_COLOR[src.source] ?? '#94a3b8'
                const label = SOURCE_LABELS[src.source] ?? src.source
                return (
                  <div key={src.source}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>{label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--ink-400)' }}>{src.replied} replied</span>
                        <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', minWidth: 32, textAlign: 'right' }}>
                          {src.rate}%
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 7, background: 'var(--ink-100)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${src.rate}%`,
                        background: color,
                        borderRadius: 99,
                        opacity: 0.7,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-300)', marginTop: 3 }}>{src.total} total</div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Velocity chart */}
      <Card accent style={{ marginBottom: 24 }}>
        <div style={{ ...labelStyle(true), marginBottom: 6 }}>Application velocity</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--action-text)' }} className="tabular">
            {data.velocity[data.velocity.length - 1]?.count ?? 0}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>this week</span>
        </div>

        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
          {data.velocity.map((v, i) => {
            const isLast = i === data.velocity.length - 1
            const pct = maxVelocity > 0 ? (v.count / maxVelocity) * 100 : 0
            return (
              <div
                key={i}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
                title={`${v.label}: ${v.count} jobs`}
              >
                {v.count > 0 && (
                  <span style={{ fontSize: 9, color: isLast ? 'var(--accent)' : 'rgba(255,255,255,0.3)', fontWeight: 700 }} className="tabular">
                    {v.count}
                  </span>
                )}
                <div style={{
                  width: '100%',
                  height: `${Math.max(pct, v.count > 0 ? 4 : 0)}%`,
                  minHeight: 2,
                  background: isLast ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                  borderRadius: 3,
                  transition: 'height 0.3s ease',
                }} />
              </div>
            )
          })}
        </div>

        {/* Labels — only show a few to avoid crowding */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#475569' }}>12w ago</span>
          <span style={{ fontSize: 10, color: '#475569' }}>6w ago</span>
          <span style={{ fontSize: 10, color: '#475569' }}>now</span>
        </div>
      </Card>
    </div>
  )
}
