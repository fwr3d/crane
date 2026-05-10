import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TutorialStep } from '../hooks/useTutorial'

interface Props {
  step: TutorialStep
  onDismiss: () => void
  onDone: () => void
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 10

export function SpotlightOverlay({ step, onDismiss, onDone }: Props) {
  const [rect, setRect] = useState<Rect | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    function track() {
      const el = document.querySelector(`[data-tutorial-id="${step.target}"]`)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
      }
      rafRef.current = requestAnimationFrame(track)
    }
    rafRef.current = requestAnimationFrame(track)
    return () => cancelAnimationFrame(rafRef.current)
  }, [step.target])

  if (!rect) return null

  const tooltipTop = rect.top + rect.height + 14
  const tooltipLeft = Math.max(12, Math.min(rect.left, window.innerWidth - 300))
  const arrowAbove = tooltipTop + 160 > window.innerHeight

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}
      onClick={onDismiss}
    >
      {/* Dark overlay with cutout */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left} y={rect.top}
              width={rect.width} height={rect.height}
              rx={8} fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
        />
        {/* Highlight border */}
        <rect
          x={rect.left} y={rect.top}
          width={rect.width} height={rect.height}
          rx={8} fill="none"
          stroke="oklch(0.72 0.12 145)"
          strokeWidth={2}
        />
      </svg>

      {/* Tooltip */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: arrowAbove ? rect.top - 10 - 140 : tooltipTop,
          left: tooltipLeft,
          width: 280,
          background: 'var(--card)',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          pointerEvents: 'all',
          transform: arrowAbove ? 'translateY(0)' : undefined,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>
          {step.label}
        </div>
        <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginBottom: 14 }}>
          {step.description}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onDone}
            style={{
              flex: 1,
              padding: '7px 0',
              background: 'var(--action)',
              color: 'var(--action-text)',
              border: 'none',
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
          <button
            onClick={onDismiss}
            style={{
              padding: '7px 14px',
              background: 'none',
              color: '#94a3b8',
              border: '1px solid var(--ink-150)',
              borderRadius: 7,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
