export function Help() {
  const sections = [
    {
      title: 'Getting started',
      items: [
        { q: 'Add your first job', a: 'Go to Board and click "+ Add a job" in any column. Fill in the company and position.' },
        { q: 'Search LinkedIn for jobs', a: 'Go to Find, enter a job title and location, then hit Search LinkedIn. Select jobs and click Add.' },
        { q: 'Update a job\'s status', a: 'Click the status pill on any job card to move it through your pipeline, or drag the card to a new column.' },
        { q: 'Set a deadline', a: 'Open a job on the Board and fill in the Deadline field. Jobs past their deadline show a warning badge.' },
      ],
    },
    {
      title: 'Board',
      items: [
        { q: 'What do the columns mean?', a: 'Not Applied → Applied → Interview → Offer → Rejected. Drag cards between columns or click the status pill.' },
        { q: 'Stale badge', a: 'An amber badge appears on Applied or Interview cards after 14 days with no update.' },
        { q: 'Search the board', a: 'Use the search bar at the top of the Board to filter by company or position.' },
      ],
    },
    {
      title: 'Find page',
      items: [
        { q: 'How does scraping work?', a: 'Crane searches LinkedIn with your keywords and filters, then shows matching jobs you can import directly to your board.' },
        { q: 'Jobs aren\'t showing up', a: 'LinkedIn rate-limits scraping. Wait a minute and try again. Easy Apply filter tends to return more results.' },
      ],
    },
    {
      title: 'Stats & export',
      items: [
        { q: 'What is response rate?', a: 'Interviews + Offers divided by total Applied. It updates as you move cards.' },
        { q: 'Export your data', a: 'Go to Settings → Export CSV. Opens a spreadsheet with all your jobs and dates.' },
      ],
    },
  ]

  return (
    <div className="fadeUp" style={{ maxWidth: 600, width: '100%' }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink-900)', letterSpacing: '-0.02em', margin: '0 0 24px' }}>
        Help
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {sections.map(section => (
          <div key={section.title}>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-400)', margin: '0 0 10px' }}>
              {section.title}
            </p>
            <div style={{ background: 'var(--card)', border: '1px solid var(--ink-150)', borderRadius: 12, overflow: 'hidden' }}>
              {section.items.map((item, i) => (
                <div key={i} style={{ padding: '14px 16px', borderBottom: i < section.items.length - 1 ? '1px solid var(--ink-100)' : 'none' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{item.q}</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.55 }}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 32, fontSize: 12, color: 'var(--ink-300)', textAlign: 'center' }}>
        Crane v1.1
      </p>
    </div>
  )
}
