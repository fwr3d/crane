import { useState } from 'react'
import { api } from '../api'
import type { Status } from '../types'

const STATUSES: Status[] = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '10px 12px', fontSize: '0.875rem', outline: 'none',
  color: '#0f172a', background: 'white', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', fontWeight: 500, color: '#94a3b8',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px',
}

export function AddJob() {
  const [company,  setCompany]  = useState('')
  const [position, setPosition] = useState('')
  const [status,   setStatus]   = useState<Status>('Not Applied')
  const [url,      setUrl]      = useState('')
  const [deadline, setDeadline] = useState('')
  const [notes,    setNotes]    = useState('')
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company.trim() || !position.trim()) return
    setLoading(true)
    await api.jobs.create({
      company, position, status,
      url:      url      || undefined,
      deadline: deadline || undefined,
      notes:    notes    || undefined,
    })
    setCompany(''); setPosition(''); setStatus('Not Applied')
    setUrl(''); setDeadline(''); setNotes('')
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 1.75rem 0' }}>
        Add Job
      </h1>

      <form onSubmit={submit} className="bg-white rounded-2xl p-6 space-y-5" style={{ border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Company</label>
            <input style={inputStyle} placeholder="e.g. Stripe" value={company}
              onChange={e => setCompany(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#94a3b8')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              required />
          </div>
          <div>
            <label style={labelStyle}>Position</label>
            <input style={inputStyle} placeholder="e.g. Software Engineer" value={position}
              onChange={e => setPosition(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#94a3b8')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Job URL</label>
            <input type="url" style={inputStyle} placeholder="https://..." value={url}
              onChange={e => setUrl(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#94a3b8')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input type="date" style={inputStyle} value={deadline}
              onChange={e => setDeadline(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#94a3b8')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)} style={{
                fontSize: '0.75rem', fontWeight: 500, padding: '5px 14px', borderRadius: 999,
                cursor: 'pointer', transition: 'all 0.15s',
                border: status === s ? '1px solid #0f172a' : '1px solid #e2e8f0',
                background: status === s ? '#0f172a' : 'white',
                color: status === s ? 'white' : '#94a3b8',
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Paste the job description, contacts, salary info..."
            value={notes} onChange={e => setNotes(e.target.value)}
            onFocus={e => (e.target.style.borderColor = '#94a3b8')}
            onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-lg transition-colors" style={{
          padding: '10px', background: loading ? '#64748b' : '#0f172a', color: 'white',
          fontSize: '0.85rem', fontWeight: 500, border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px',
        }}>
          {loading ? 'Adding...' : 'Add Job'}
        </button>

        {saved && (
          <p style={{ fontSize: '0.78rem', color: '#10b981', textAlign: 'center', fontWeight: 500 }}>Job added.</p>
        )}
      </form>
    </div>
  )
}
