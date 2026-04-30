import { useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { api } from '../api'
import type { Job } from '../types'
import { CompanyLogo } from '../components/CompanyLogo'

type ResultView = 'all' | 'selected' | 'unselected'
type ResultSort = 'original' | 'company' | 'role'

const JOB_TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'internship', label: 'Internship' },
]

const EXPERIENCE_OPTIONS = [
  { value: 'internship', label: 'Internship' },
  { value: 'entry', label: 'Entry level' },
  { value: 'associate', label: 'Associate' },
  { value: 'mid-senior', label: 'Mid-senior' },
  { value: 'director', label: 'Director' },
  { value: 'executive', label: 'Executive' },
]

const WORKPLACE_OPTIONS = [
  { value: 'on-site', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
]

const PAGE_SIZE = 25

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '10px 12px', fontSize: '0.875rem', outline: 'none',
  color: '#0f172a', background: 'white', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', fontWeight: 500, color: '#94a3b8',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px',
}

export function Scrape() {
  const [search,   setSearch]   = useState('Software Engineer')
  const [location, setLocation] = useState('California')
  const [jobTypes, setJobTypes] = useState<Set<string>>(new Set(['full-time']))
  const [experienceLevels, setExperienceLevels] = useState<Set<string>>(new Set())
  const [workplaceTypes, setWorkplaceTypes] = useState<Set<string>>(new Set())
  const [datePosted, setDatePosted] = useState('')
  const [easyApply, setEasyApply] = useState(false)
  const [results,  setResults]  = useState<Job[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [resultQuery, setResultQuery] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [resultView, setResultView] = useState<ResultView>('all')
  const [resultSort, setResultSort] = useState<ResultSort>('original')
  const [resultPage, setResultPage] = useState(1)
  const [scrapedPages, setScrapedPages] = useState(0)
  const [scrapeMessage, setScrapeMessage] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [adding,   setAdding]   = useState(false)
  const [done,     setDone]     = useState(false)
  const scrapeAbortRef = useRef<AbortController | null>(null)

  const companies = useMemo(() => {
    if (!results) return []
    return [...new Set(results.map(job => job.company).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [results])

  const visibleResults = useMemo(() => {
    if (!results) return []
    const query = resultQuery.trim().toLowerCase()

    const entries = results
      .map((job, index) => ({ job, index }))
      .filter(({ job, index }) => {
        const matchesText = !query || `${job.company} ${job.position}`.toLowerCase().includes(query)
        const matchesCompany = companyFilter === 'all' || job.company === companyFilter
        const matchesView =
          resultView === 'all' ||
          (resultView === 'selected' && selected.has(index)) ||
          (resultView === 'unselected' && !selected.has(index))

        return matchesText && matchesCompany && matchesView
      })

    if (resultSort === 'company') entries.sort((a, b) => a.job.company.localeCompare(b.job.company))
    if (resultSort === 'role') entries.sort((a, b) => a.job.position.localeCompare(b.job.position))

    return entries
  }, [results, resultQuery, companyFilter, resultView, selected, resultSort])

  const totalPages = Math.max(1, Math.ceil(visibleResults.length / PAGE_SIZE))
  const currentPage = Math.min(resultPage, totalPages)
  const pagedResults = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return visibleResults.slice(start, start + PAGE_SIZE)
  }, [visibleResults, currentPage])
  const pageStart = visibleResults.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, visibleResults.length)

  const filtersActive = resultQuery.trim() !== '' || companyFilter !== 'all' || resultView !== 'all' || resultSort !== 'original'

  const toggleSet = (setter: Dispatch<SetStateAction<Set<string>>>, value: string) => {
    setter(previous => {
      const next = new Set(previous)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const scrape = async () => {
    scrapeAbortRef.current?.abort()
    const controller = new AbortController()
    scrapeAbortRef.current = controller

    setLoading(true)
    setResults([])
    setSelected(new Set())
    setResultQuery('')
    setCompanyFilter('all')
    setResultView('all')
    setResultSort('original')
    setResultPage(1)
    setScrapedPages(0)
    setScrapeMessage('Connecting to LinkedIn...')
    setDone(false)
    try {
      await api.scrapeStream(
        search,
        location,
        {
          jobTypes: [...jobTypes],
          experienceLevels: [...experienceLevels],
          workplaceTypes: [...workplaceTypes],
          datePosted,
          easyApply,
        },
        event => {
          if (event.type === 'page') {
            setScrapedPages(event.page)
            setResults(previous => [...(previous ?? []), ...event.jobs])
            setScrapeMessage(`Fetched ${event.total} jobs from ${event.page} LinkedIn page${event.page === 1 ? '' : 's'}...`)
            return
          }

          if (event.type === 'rate_limited') {
            setScrapeMessage(event.message)
            return
          }

          setScrapeMessage(`Finished with ${event.total} scraped jobs.`)
        },
        controller.signal,
      )
    } catch (error) {
      if (controller.signal.aborted) {
        setScrapeMessage('Stopped. Showing the jobs fetched so far.')
      } else {
        setScrapeMessage(error instanceof Error ? error.message : 'Could not finish scraping.')
      }
    } finally {
      if (scrapeAbortRef.current === controller) scrapeAbortRef.current = null
      setLoading(false)
    }
  }

  const stopScrape = () => {
    scrapeAbortRef.current?.abort()
  }

  const toggle = (i: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const toggleAll = () => {
    if (!results) return
    const visibleIndexes = pagedResults.map(entry => entry.index)
    const allVisibleSelected = visibleIndexes.length > 0 && visibleIndexes.every(index => selected.has(index))

    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleIndexes.forEach(index => next.delete(index))
      else visibleIndexes.forEach(index => next.add(index))
      return next
    })
  }

  const addSelected = async () => {
    if (!results) return
    setAdding(true)
    await Promise.allSettled(
      [...selected].map(i => api.jobs.create({
        company:  results[i].company,
        position: results[i].position,
        status:   'Not Applied',
        url:      results[i].url,
        location: results[i].location,
      }))
    )
    setAdding(false)
    setDone(true)
    setResults(null)
  }

  const clearResultFilters = () => {
    setResultQuery('')
    setCompanyFilter('all')
    setResultView('all')
    setResultSort('original')
    setResultPage(1)
  }

  return (
    <div className="space-y-6 fadeUp" style={{ maxWidth: '720px' }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
        Scrape LinkedIn
      </h1>

      <div className="bg-white rounded-2xl p-6 space-y-5" style={{ border: '1px solid #e2e8f0', maxWidth: '680px' }}>
        <div className="flex gap-4">
          <div className="flex-1">
            <label style={labelStyle}>Job title</label>
            <input style={inputStyle} value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#94a3b8')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
          </div>
          <div className="flex-1">
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#94a3b8')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Employment type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {JOB_TYPE_OPTIONS.map(option => {
                const selected = jobTypes.has(option.value)
                return (
                  <button key={option.value} type="button" onClick={() => toggleSet(setJobTypes, option.value)} style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: 999,
                    border: selected ? '1px solid var(--ink-900)' : '1px solid var(--ink-150)',
                    background: selected ? 'var(--ink-900)' : 'white',
                    color: selected ? 'white' : 'var(--ink-500)',
                    cursor: 'pointer',
                  }}>
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Experience level</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EXPERIENCE_OPTIONS.map(option => {
                const selected = experienceLevels.has(option.value)
                return (
                  <button key={option.value} type="button" onClick={() => toggleSet(setExperienceLevels, option.value)} style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: 999,
                    border: selected ? '1px solid var(--accent-line)' : '1px solid var(--ink-150)',
                    background: selected ? 'var(--accent-bg)' : 'white',
                    color: selected ? 'var(--accent)' : 'var(--ink-500)',
                    cursor: 'pointer',
                  }}>
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Workplace</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {WORKPLACE_OPTIONS.map(option => {
                  const selected = workplaceTypes.has(option.value)
                  return (
                    <button key={option.value} type="button" onClick={() => toggleSet(setWorkplaceTypes, option.value)} style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '5px 10px',
                      borderRadius: 999,
                      border: selected ? '1px solid var(--ink-900)' : '1px solid var(--ink-150)',
                      background: selected ? 'var(--ink-900)' : 'white',
                      color: selected ? 'white' : 'var(--ink-500)',
                      cursor: 'pointer',
                    }}>
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Date posted</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={datePosted} onChange={event => setDatePosted(event.target.value)}>
                <option value="">Any time</option>
                <option value="past-24h">Past 24 hours</option>
                <option value="past-week">Past week</option>
                <option value="past-month">Past month</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 39, fontSize: 12.5, color: 'var(--ink-600)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={easyApply} onChange={event => setEasyApply(event.target.checked)} style={{ accentColor: 'var(--ink-900)' }} />
              Easy Apply
            </label>
          </div>
        </div>
        <button onClick={scrape} disabled={loading} className="w-full rounded-lg transition-colors" style={{
          padding: '10px', background: loading ? '#64748b' : '#0f172a', color: 'white',
          fontSize: '0.85rem', fontWeight: 500, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? `Searching... ${results?.length ?? 0} found` : 'Search LinkedIn'}
        </button>
      </div>

      {(loading || scrapeMessage) && (
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid var(--ink-150)', maxWidth: 680 }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-800)' }}>
                {loading ? 'Scraping LinkedIn' : 'Scrape complete'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-400)' }}>
                {scrapeMessage || 'Fetching the first page...'}
              </p>
            </div>
            {loading && (
              <button
                type="button"
                onClick={stopScrape}
                style={{ fontSize: 12, color: 'var(--ink-700)', background: 'white', border: '1px solid var(--ink-150)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Stop
              </button>
            )}
          </div>
          <div style={{ marginTop: 12, height: 6, overflow: 'hidden', borderRadius: 999, background: 'var(--ink-100)' }}>
            <div style={{
              width: loading ? '62%' : '100%',
              height: '100%',
              borderRadius: 999,
              background: 'var(--ink-900)',
              transition: 'width 240ms ease',
            }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ink-300)' }}>
            {scrapedPages > 0 ? `${scrapedPages} LinkedIn page${scrapedPages === 1 ? '' : 's'} fetched` : 'Waiting for LinkedIn...'}
          </p>
        </div>
      )}

      {done && <p style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 500 }}>Jobs added successfully.</p>}

      {results !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Showing {pageStart}-{pageEnd} of {visibleResults.length} filtered jobs - {results.length} scraped - {selected.size} selected
            </p>
            <button onClick={toggleAll} style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#94a3b8'}
            >
              {pagedResults.length > 0 && pagedResults.every(entry => selected.has(entry.index)) ? 'Deselect page' : 'Select page'}
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid var(--ink-150)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) minmax(150px, 1fr) minmax(130px, auto) minmax(130px, auto)', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Filter results</label>
                <input
                  style={inputStyle}
                  placeholder="Company or role..."
                  value={resultQuery}
                  onChange={event => {
                    setResultQuery(event.target.value)
                    setResultPage(1)
                  }}
                  onFocus={e => (e.target.style.borderColor = '#94a3b8')}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={companyFilter} onChange={event => {
                  setCompanyFilter(event.target.value)
                  setResultPage(1)
                }}>
                  <option value="all">All companies</option>
                  {companies.map(company => <option key={company} value={company}>{company}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Show</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={resultView} onChange={event => {
                  setResultView(event.target.value as ResultView)
                  setResultPage(1)
                }}>
                  <option value="all">All</option>
                  <option value="selected">Selected</option>
                  <option value="unselected">Unselected</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sort</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={resultSort} onChange={event => {
                  setResultSort(event.target.value as ResultSort)
                  setResultPage(1)
                }}>
                  <option value="original">Original</option>
                  <option value="company">Company</option>
                  <option value="role">Role</option>
                </select>
              </div>
            </div>
            {filtersActive && (
              <button
                onClick={clearResultFilters}
                style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onMouseEnter={event => (event.currentTarget.style.color = 'var(--ink-800)')}
                onMouseLeave={event => (event.currentTarget.style.color = 'var(--ink-400)')}
              >
                Clear result filters
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {pagedResults.map(({ job, index }) => (
              <label key={index} className="flex items-center gap-3 bg-white cursor-pointer transition-all" style={{
                border: selected.has(index) ? '1px solid #94a3b8' : '1px solid #e2e8f0',
                borderRadius: '10px', padding: '10px 14px',
              }}>
                <input type="checkbox" checked={selected.has(index)} onChange={() => toggle(index)}
                  style={{ accentColor: '#0f172a', width: '14px', height: '14px', flexShrink: 0 }} />
                <CompanyLogo company={job.company} size={30} />
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', margin: 0 }} className="truncate">
                    {job.position}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '1px 0 0' }} className="truncate">
                    {job.company}{job.location ? ` - ${job.location}` : ''}
                  </p>
                </div>
              </label>
            ))}
            {visibleResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-300)', fontSize: 13 }}>
                No scraped jobs match those filters.
              </div>
            )}
          </div>

          {visibleResults.length > PAGE_SIZE && (
            <div className="flex items-center justify-between" style={{ paddingTop: 4 }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setResultPage(page => Math.max(1, page - 1))}
                style={{ fontSize: 12, color: currentPage === 1 ? 'var(--ink-300)' : 'var(--ink-700)', background: 'white', border: '1px solid var(--ink-150)', borderRadius: 8, padding: '7px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setResultPage(page => Math.min(totalPages, page + 1))}
                style={{ fontSize: 12, color: currentPage === totalPages ? 'var(--ink-300)' : 'var(--ink-700)', background: 'white', border: '1px solid var(--ink-150)', borderRadius: 8, padding: '7px 10px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          )}

          {selected.size > 0 && (
            <button onClick={addSelected} disabled={adding} className="w-full rounded-lg transition-colors" style={{
              padding: '10px', background: adding ? '#64748b' : '#0f172a', color: 'white',
              fontSize: '0.85rem', fontWeight: 500, border: 'none', cursor: adding ? 'not-allowed' : 'pointer',
            }}>
              {adding ? 'Adding...' : `Add ${selected.size} job${selected.size > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
