import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { TutorialStep, TutorialStepId } from '../hooks/useTutorial'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  steps: TutorialStep[]
  onSpotlight: (id: TutorialStepId) => void
  onDismiss: () => void
}

export function TutorialChecklist({ steps, onSpotlight, onDismiss }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const done = steps.filter(s => s.done).length
  const isMobile = useIsMobile()

  return createPortal(
    <div style={{
      position: 'fixed',
      right: isMobile ? 12 : 24,
      bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 68px)' : 24,
      zIndex: 80,
      width: 'min(340px, calc(100vw - 24px))',
    }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--ink-150)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 22px 70px rgba(15,23,42,0.34)',
      }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-900)',
          }}
        >
          <svg width={20} height={20} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
            <circle cx={10} cy={10} r={8} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={2.5} />
            <circle
              cx={10}
              cy={10}
              r={8}
              fill="none"
              stroke="oklch(0.72 0.12 145)"
              strokeWidth={2.5}
              strokeDasharray={`${(done / steps.length) * 50.3} 50.3`}
              strokeLinecap="round"
              transform="rotate(-90 10 10)"
            />
          </svg>
          <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, textAlign: 'left', color: 'var(--ink-900)' }}>
            Getting started
          </span>
          <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
            {done}/{steps.length}
          </span>
          <span style={{ fontSize: 10, color: '#64748b', marginLeft: 2 }}>
            {collapsed ? 'v' : '^'}
          </span>
        </button>

        {!collapsed && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {steps.map(step => (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 0',
                  opacity: step.done ? 0.45 : 1,
                }}
              >
                <div style={{
                  width: 15,
                  height: 15,
                  borderRadius: 4,
                  border: step.done ? 'none' : '1.5px solid #475569',
                  background: step.done ? 'oklch(0.72 0.12 145)' : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {step.done && (
                    <svg width={9} height={9} viewBox="0 0 9 9">
                      <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" fill="none" stroke="var(--paper)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ flex: 1, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.3, textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.label}
                </span>
                {!step.done && (
                  <button
                    onClick={() => onSpotlight(step.id)}
                    style={{
                      fontSize: 10,
                      color: 'oklch(0.72 0.12 145)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    Show
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={onDismiss}
              style={{
                marginTop: 6,
                fontSize: 10.5,
                color: '#64748b',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
            >
              Dismiss tutorial
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
