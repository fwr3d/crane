import { useEffect, useRef, useState } from 'react'
import type { Status } from '../types'
import { STATUS_LIST, tokenFor } from './statusTokens'

export function StatusDot({ status, size = 6 }: { status: Status | string; size?: number }) {
  const c = tokenFor(status)
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: c.dot,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

export function StatusBadge({ status }: { status: Status | string }) {
  const c = tokenFor(status)
  return (
    <span
      style={{
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 999,
        padding: '3px 10px 3px 8px',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <StatusDot status={status} />
      {status}
    </span>
  )
}

export function StatusPill({ status, onChange }: { status: Status; onChange?: (status: Status) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const c = tokenFor(status)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={event => {
          event.stopPropagation()
          if (onChange) setOpen(value => !value)
        }}
        style={{
          color: c.text,
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 999,
          padding: '3px 9px 3px 8px',
          fontSize: '0.72rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: onChange ? 'pointer' : 'default',
        }}
      >
        <StatusDot status={status} />
        {status}
        {onChange && <span style={{ opacity: 0.55, fontSize: '0.62rem', marginLeft: 1 }}>v</span>}
      </button>

      {open && onChange && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            minWidth: 142,
            background: 'white',
            border: '1px solid var(--ink-150)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
          }}
        >
          {STATUS_LIST.map(nextStatus => (
            <button
              key={nextStatus}
              type="button"
              onClick={() => {
                onChange(nextStatus)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: 'none',
                background: status === nextStatus ? 'var(--ink-50)' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.78rem',
                color: 'var(--ink-800)',
                textAlign: 'left',
              }}
              onMouseEnter={event => (event.currentTarget.style.background = 'var(--ink-50)')}
              onMouseLeave={event => (event.currentTarget.style.background = status === nextStatus ? 'var(--ink-50)' : 'transparent')}
            >
              <StatusDot status={nextStatus} />
              {nextStatus}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
