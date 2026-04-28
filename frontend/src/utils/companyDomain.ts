const cache = new Map<string, string | null>()

export async function lookupDomain(company: string): Promise<string | null> {
  if (cache.has(company)) return cache.get(company)!
  try {
    const res  = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`)
    const data = await res.json()
    const domain = data[0]?.domain ?? null
    cache.set(company, domain)
    return domain
  } catch {
    cache.set(company, null)
    return null
  }
}

export async function linkedinJobsUrl(company: string, _position: string, savedUrl?: string | null): Promise<string> {
  if (savedUrl) return savedUrl
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(company)}&origin=JOB_SEARCH_PAGE_KEYWORD_AUTOCOMPLETE`
}
