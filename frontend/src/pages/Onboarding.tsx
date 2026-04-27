import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { supabase } from '../lib/supabase'
import craneLogo from '../assets/crane.svg'

type Step = 'welcome' | 'account' | 'profile' | 'first-job' | 'done'

const HEADING: React.CSSProperties = { fontFamily: "'Syne', sans-serif" }
const BODY:    React.CSSProperties = { fontFamily: "'Figtree', system-ui, sans-serif" }
const STATUSES = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', color: 'white',
  fontSize: '0.9rem', outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'Figtree', system-ui, sans-serif",
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', fontWeight: 600,
  color: '#475569', letterSpacing: '0.1em',
  textTransform: 'uppercase', marginBottom: '6px',
}

function PrimaryBtn({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...HEADING, display: 'block', width: '100%', marginTop: '1.5rem',
        padding: '14px', borderRadius: '8px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 700, fontSize: '0.9rem',
        background: disabled ? 'rgba(255,255,255,0.08)' : 'white',
        color: disabled ? '#334155' : '#0c111d',
        transition: 'background 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      ...BODY, display: 'block', width: '100%', marginTop: '12px',
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '0.82rem', color: '#334155', textAlign: 'center',
    }}>
      {children}
    </button>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'rgba(255,255,255,0.35)'
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'rgba(255,255,255,0.1)'
}

export function Onboarding() {
  const { user, profile, loading, signUp, signIn, saveProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]       = useState<Step>('welcome')
  const [mode, setMode]       = useState<'signup' | 'signin'>('signup')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')
  const [role, setRole]       = useState('')
  const [location, setLocation] = useState('')
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [status, setStatus]   = useState('Not Applied')
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(false)

  useEffect(() => {
    if (loading) return

    if (user && profile?.name && (step === 'welcome' || step === 'account')) {
      navigate('/app', { replace: true })
      return
    }

  }, [loading, user, profile, step, navigate])

  const handleAccount = async () => {
    setError('')
    setBusy(true)
    const { error, hasSession } = await (mode === 'signup' ? signUp : signIn)(email, password)
    setBusy(false)
    if (error) { setError(error.message); return }
    if (!hasSession) {
      setMode('signin')
      setError(mode === 'signup'
        ? 'Account created. Check your email to confirm it, then sign in here.'
        : 'Signed in, but no active session was returned. Please try again.')
      return
    }
    if (mode === 'signin') { navigate('/app', { replace: true }); return }
    setStep('profile')
  }

  const handleProfile = async () => {
    setError('')
    setBusy(true)
    try {
      await saveProfile({ name, target_role: role, location: location || null })
      setStep('first-job')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  const handleFirstJob = async (skip = false) => {
    setError('')
    setBusy(true)
    try {
      if (!skip && company && position) {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!u) throw new Error('Please sign in before adding your first job.')

        const { error } = await supabase.from('jobs').insert({ company, position, status, user_id: u.id })
        if (error) throw error
      }
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add your first job.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  const currentStep: Step = user && !profile?.name && (step === 'welcome' || step === 'account') ? 'profile' : step
  const dots: Step[] = ['account', 'profile', 'first-job']
  const dotIdx = dots.indexOf(currentStep)

  return (
    <div style={{
      ...BODY, minHeight: '100vh', background: '#0c111d', color: 'white',
      display: 'flex', flexDirection: 'column',
      WebkitFontSmoothing: 'antialiased' as const,
    }}>

      {/* Header — only during middle steps */}
      {currentStep !== 'welcome' && currentStep !== 'done' && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 3rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={craneLogo} alt="" style={{ width: '22px', height: '22px' }} />
            <span style={{ ...HEADING, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Crane
            </span>
          </div>

          <div style={{ display: 'flex', gap: '7px' }}>
            {dots.map((s, i) => (
              <div key={s} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: i <= dotIdx ? 'white' : 'rgba(255,255,255,0.15)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <div style={{ width: '80px' }} />
        </header>
      )}

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>

        {/* ── Welcome ── */}
        {currentStep === 'welcome' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '440px' }}>
            <img src={craneLogo} alt="Crane" style={{ width: 'clamp(72px, 10vw, 96px)', height: 'auto', marginBottom: '2rem' }} />
            <h1 style={{
              ...HEADING, fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800,
              letterSpacing: '-0.03em', margin: '0 0 1rem', lineHeight: 1.05,
            }}>
              Your search,<br />organized.
            </h1>
            <p style={{ fontSize: '0.95rem', color: '#475569', margin: '0 0 2.5rem', lineHeight: 1.65 }}>
              Track every application. Follow up on time.<br />Never lose a job lead again.
            </p>
            <button
              onClick={() => setStep('account')}
              style={{
                ...HEADING, fontWeight: 700, fontSize: '0.95rem',
                background: 'white', color: '#0c111d',
                padding: '16px 36px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                boxShadow: '0 10px 30px -10px rgba(255,255,255,0.25)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 36px -10px rgba(255,255,255,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(255,255,255,0.25)' }}
            >
              Get started
            </button>
            <button
              onClick={() => { setMode('signin'); setStep('account') }}
              style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#334155', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Already have an account?{' '}
              <span style={{ color: '#64748b' }}>Sign in</span>
            </button>
          </div>
        )}

        {/* ── Account ── */}
        {currentStep === 'account' && (
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <h2 style={{ ...HEADING, fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 0.5rem' }}>
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 2rem' }}>
              {mode === 'signup' ? 'Free forever. No credit card.' : 'Sign in to your account.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email" placeholder="Email address" value={email}
                onChange={e => setEmail(e.target.value)} style={inputStyle}
                onFocus={focusIn} onBlur={focusOut}
              />
              <input
                type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} style={inputStyle}
                onFocus={focusIn} onBlur={focusOut}
                onKeyDown={e => e.key === 'Enter' && handleAccount()}
              />
            </div>

            {error && (
              <p style={{ fontSize: '0.8rem', color: '#f87171', margin: '10px 0 0' }}>{error}</p>
            )}

            <PrimaryBtn onClick={handleAccount} disabled={busy || !email || !password}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account →' : 'Sign in →'}
            </PrimaryBtn>
            <GhostBtn onClick={() => { setMode(m => m === 'signup' ? 'signin' : 'signup'); setError('') }}>
              {mode === 'signup'
                ? <>Already have an account? <span style={{ color: '#64748b' }}>Sign in</span></>
                : <>No account? <span style={{ color: '#64748b' }}>Create one</span></>}
            </GhostBtn>
          </div>
        )}

        {/* ── Profile ── */}
        {currentStep === 'profile' && (
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <h2 style={{ ...HEADING, fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 0.5rem' }}>
              Tell us about yourself
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 2rem' }}>
              Personalizes your dashboard and queue.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field label="Your name">
                <input type="text" placeholder="Alex" value={name}
                  onChange={e => setName(e.target.value)} style={inputStyle}
                  onFocus={focusIn} onBlur={focusOut} autoFocus />
              </Field>
              <Field label="Target role">
                <input type="text" placeholder="Software Engineer" value={role}
                  onChange={e => setRole(e.target.value)} style={inputStyle}
                  onFocus={focusIn} onBlur={focusOut} />
              </Field>
              <Field label={<>Location <span style={{ color: '#1e293b', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></>}>
                <input type="text" placeholder="New York, NY" value={location}
                  onChange={e => setLocation(e.target.value)} style={inputStyle}
                  onFocus={focusIn} onBlur={focusOut}
                  onKeyDown={e => e.key === 'Enter' && name && handleProfile()} />
              </Field>
            </div>

            {error && (
              <p style={{ fontSize: '0.8rem', color: '#f87171', margin: '10px 0 0' }}>{error}</p>
            )}
            <PrimaryBtn onClick={handleProfile} disabled={busy || !name}>
              {busy ? 'Saving…' : 'Continue →'}
            </PrimaryBtn>
          </div>
        )}

        {/* ── First job ── */}
        {currentStep === 'first-job' && (
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <h2 style={{ ...HEADING, fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 0.5rem' }}>
              Add your first job
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 2rem' }}>
              Already applied somewhere? Start tracking it now.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field label="Company">
                <input type="text" placeholder="Notion" value={company}
                  onChange={e => setCompany(e.target.value)} style={inputStyle}
                  onFocus={focusIn} onBlur={focusOut} autoFocus />
              </Field>
              <Field label="Position">
                <input type="text" placeholder="Software Engineer" value={position}
                  onChange={e => setPosition(e.target.value)} style={inputStyle}
                  onFocus={focusIn} onBlur={focusOut} />
              </Field>
              <Field label="Status">
                <select value={status} onChange={e => setStatus(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <PrimaryBtn onClick={() => handleFirstJob(false)} disabled={busy || !company || !position}>
              {busy ? 'Adding…' : 'Add job →'}
            </PrimaryBtn>
            <GhostBtn onClick={() => handleFirstJob(true)}>Skip for now</GhostBtn>
            {error && (
              <p style={{ fontSize: '0.8rem', color: '#f87171', margin: '10px 0 0' }}>{error}</p>
            )}
          </div>
        )}

        {/* ── Done ── */}
        {currentStep === 'done' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={craneLogo} alt="" style={{ width: '80px', height: 'auto', marginBottom: '2rem' }} />
            <h2 style={{ ...HEADING, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.75rem' }}>
              You're all set{name ? `, ${name.split(' ')[0]}` : ''}.
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0 0 2.5rem', lineHeight: 1.6 }}>
              Your search is organized.<br />Let's find the one.
            </p>
            <button
              onClick={() => navigate('/app', { replace: true })}
              style={{
                ...HEADING, fontWeight: 700, fontSize: '0.95rem',
                background: 'white', color: '#0c111d',
                padding: '16px 36px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                boxShadow: '0 10px 30px -10px rgba(255,255,255,0.25)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 36px -10px rgba(255,255,255,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(255,255,255,0.25)' }}
            >
              Open Crane →
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
