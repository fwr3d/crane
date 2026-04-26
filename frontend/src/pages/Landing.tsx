import craneLogo from '../assets/crane.svg'

const HEADING = { fontFamily: "'Syne', sans-serif" }
const BODY    = { fontFamily: "'Figtree', system-ui, sans-serif" }

const features = [
  {
    title: 'Track everything',
    desc:  'Add jobs manually or scrape LinkedIn directly. Every application in one place.',
  },
  {
    title: 'Know where you stand',
    desc:  'Pipeline breakdown, response rates, offer rates. See your search clearly.',
  },
  {
    title: 'Move fast',
    desc:  'Update statuses in one click. No bloat, no friction, just your job search.',
  },
]

export function Landing() {
  return (
    <div style={{ ...BODY, background: '#0c111d', minHeight: '100vh', color: 'white' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 3rem', borderBottom: '1px solid #ffffff0f' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={craneLogo} alt="Crane" style={{ width: '28px', height: '28px' }} />
          <span style={{ ...HEADING, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Crane
          </span>
        </div>
        <a
          href="/app"
          style={{
            ...BODY,
            fontSize: '0.82rem',
            fontWeight: 500,
            color: '#0c111d',
            background: 'white',
            padding: '8px 20px',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Open app
        </a>
      </nav>

      {/* Hero */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '7rem 2rem 5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <img src={craneLogo} alt="" style={{ width: '72px', height: '72px' }} />
        </div>

        <h1 style={{ ...HEADING, fontSize: 'clamp(2.8rem, 6vw, 5rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 1.5rem', maxWidth: '700px' }}>
          Your job search,<br />finally under control.
        </h1>

        <p style={{ fontSize: '1.05rem', color: '#64748b', maxWidth: '480px', lineHeight: 1.7, margin: '0 0 2.5rem' }}>
          Crane tracks every application, shows you where things stand, and scrapes LinkedIn so you never lose a lead.
        </p>

        <a
          href="/app"
          style={{
            ...HEADING,
            fontSize: '0.9rem',
            fontWeight: 700,
            color: '#0c111d',
            background: 'white',
            padding: '14px 32px',
            borderRadius: '10px',
            textDecoration: 'none',
            letterSpacing: '0.01em',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Get started
        </a>
      </section>

      {/* Divider */}
      <div style={{ height: '1px', background: '#ffffff0a', margin: '0 3rem' }} />

      {/* Features */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: '#ffffff0a', margin: '4rem 3rem', borderRadius: '16px', overflow: 'hidden' }}>
        {features.map(f => (
          <div key={f.title} style={{ background: '#0c111d', padding: '2.5rem 2rem' }}>
            <h3 style={{ ...HEADING, fontSize: '1rem', fontWeight: 700, color: 'white', margin: '0 0 0.75rem', letterSpacing: '-0.01em' }}>
              {f.title}
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.7, margin: 0 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '2rem', borderTop: '1px solid #ffffff0a' }}>
        <p style={{ fontSize: '0.72rem', color: '#1e293b', margin: 0 }}>Crane — built for the search.</p>
      </footer>

    </div>
  )
}
