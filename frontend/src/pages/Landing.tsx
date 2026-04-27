import craneLogo from '../assets/crane.svg'

const HEADING = { fontFamily: "'Syne', sans-serif" }
const BODY    = { fontFamily: "'Figtree', system-ui, sans-serif" }

export function Landing() {
  return (
    <div style={{
      ...BODY,
      background: '#0c111d',
      color: 'white',
      minHeight: '100vh',
      overflow: 'hidden',
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
    }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.25rem 3rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={craneLogo} alt="Crane" style={{ width: '26px', height: '26px' }} />
          <span style={{ ...HEADING, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Crane
          </span>
        </div>
        <a
          href="/onboarding"
          style={{
            ...BODY,
            fontSize: '0.82rem', fontWeight: 600,
            color: '#0c111d', background: 'white',
            padding: '9px 18px', borderRadius: '8px',
            textDecoration: 'none',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1';   e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Open app
        </a>
      </nav>

      {/* Hero */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: '2rem',
      }}>
        <img
          src={craneLogo}
          alt=""
          style={{ width: 'clamp(160px, 24vw, 240px)', height: 'auto', marginBottom: '2rem' }}
        />

        <p style={{
          ...HEADING,
          fontSize: '0.78rem', fontWeight: 600,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#94a3b8', margin: '0 0 2.25rem',
        }}>
          The job tracker that keeps up.
        </p>

        <a
          href="/onboarding"
          style={{
            ...HEADING,
            fontSize: '0.95rem', fontWeight: 700,
            color: '#0c111d', background: 'white',
            padding: '16px 30px', borderRadius: '10px',
            textDecoration: 'none',
            boxShadow: '0 10px 30px -10px rgba(255,255,255,0.25)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 36px -10px rgba(255,255,255,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(255,255,255,0.25)' }}
        >
          Open the app
        </a>

        <p style={{ ...BODY, fontSize: '0.78rem', color: '#475569', marginTop: '1.25rem' }}>
          Free to start. Your search stays organized.
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.25rem 3rem',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={craneLogo} alt="" style={{ width: '14px', height: '14px', opacity: 0.5 }} />
          <span style={{ fontSize: '0.75rem', color: '#475569' }}>Crane — built for the search.</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#475569' }}>© 2025</span>
      </footer>

    </div>
  )
}
