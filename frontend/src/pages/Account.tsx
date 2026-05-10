import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/auth'
import { useIsMobile } from '../hooks/useIsMobile'

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--ink-150)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: '0.9rem',
  outline: 'none',
  color: 'var(--ink-800)',
  background: 'var(--control)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--ink-400)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

function ActionButton({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '11px 12px',
        borderRadius: 8,
        border: `1px solid ${danger ? 'var(--danger-line)' : 'var(--ink-150)'}`,
        background: danger ? 'var(--danger-bg)' : 'var(--control)',
        color: danger ? 'var(--danger)' : 'var(--ink-700)',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function Account({ dark, toggleDark, onJobsCleared }: { dark: boolean; toggleDark: () => void; onJobsCleared: () => void }) {
  const { user, profile, signOut, saveProfile } = useAuth()
  const isMobile = useIsMobile()
  const [name, setName] = useState(profile?.name ?? '')
  const [role, setRole] = useState(profile?.target_role ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success')

  const displayName = profile?.name?.trim() || user?.email || 'Account'
  const initials = displayName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await saveProfile({
        name: name.trim() || null,
        target_role: role.trim() || null,
        location: location.trim() || null,
      })
      setMessageKind('success')
      setMessage('Profile saved.')
    } catch (error) {
      setMessageKind('error')
      setMessage(error instanceof Error ? error.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  const clearJobs = async () => {
    if (!window.confirm('Clear all jobs? This cannot be undone.')) return
    setActionBusy('clear')
    setMessage('')
    try {
      await api.jobs.clear()
      onJobsCleared()
      setMessageKind('success')
      setMessage('Jobs cleared.')
    } catch (error) {
      setMessageKind('error')
      setMessage(error instanceof Error ? error.message : 'Could not clear jobs.')
    } finally {
      setActionBusy('')
    }
  }

  const exportJobs = async () => {
    setActionBusy('export')
    setMessage('')
    try {
      await api.exportCsv()
      setMessageKind('success')
      setMessage('CSV export started.')
    } catch (error) {
      setMessageKind('error')
      setMessage(error instanceof Error ? error.message : 'Could not export jobs.')
    } finally {
      setActionBusy('')
    }
  }

  return (
    <div className="fadeUp" style={{ maxWidth: 760 }}>
      <header style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 className="display" style={{ fontSize: isMobile ? 22 : 28, margin: 0 }}>Account</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-400)', margin: '6px 0 0' }}>
          Manage your Crane profile and app settings.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', gap: 16, alignItems: 'start' }}>
        <section style={{ background: 'var(--card)', border: '1px solid var(--ink-150)', borderRadius: 14, padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: 'oklch(0.72 0.12 145)',
              color: 'var(--paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={name} onChange={event => setName(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Target role</label>
              <input style={inputStyle} value={role} onChange={event => setRole(event.target.value)} placeholder="Software Engineer" />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={location} onChange={event => setLocation(event.target.value)} placeholder="New York, NY" />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            style={{
              marginTop: 18,
              width: '100%',
              padding: '11px',
              borderRadius: 8,
              border: 'none',
              background: saving ? 'var(--action-muted)' : 'var(--action)',
              color: 'var(--action-text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save profile'}
          </button>

          {message && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: messageKind === 'success' ? 'var(--offer)' : 'var(--danger)' }}>
              {message}
            </p>
          )}
        </section>

        <section style={{ display: 'grid', gap: 10 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--ink-150)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
            <div style={labelStyle}>Appearance</div>
            <p style={{ margin: '2px 0 12px', fontSize: 13, color: 'var(--ink-500)' }}>
              Current theme: <span style={{ fontWeight: 700, color: 'var(--ink-800)' }}>{dark ? 'Dark' : 'Light'}</span>
            </p>
            <button
              onClick={toggleDark}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ink-150)', background: 'var(--control)', color: 'var(--ink-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {dark ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
          </div>
          <ActionButton onClick={exportJobs} disabled={Boolean(actionBusy)}>
            {actionBusy === 'export' ? 'Preparing export...' : 'Export CSV'}
          </ActionButton>
          <ActionButton onClick={clearJobs} danger disabled={Boolean(actionBusy)}>
            {actionBusy === 'clear' ? 'Clearing jobs...' : 'Clear all jobs'}
          </ActionButton>
          <ActionButton onClick={() => signOut()} disabled={Boolean(actionBusy)}>
            Sign out
          </ActionButton>
        </section>
      </div>
    </div>
  )
}
