const cache = new Map<string, string | null>()

type ClearbitCompany = {
  name?: string
  domain?: string
}

const MANUAL_DOMAINS: Record<string, string> = {
  airbnb: 'airbnb.com',
  amazon: 'amazon.com',
  apple: 'apple.com',
  google: 'google.com',
  linkedin: 'linkedin.com',
  meta: 'meta.com',
  microsoft: 'microsoft.com',
  netflix: 'netflix.com',
  notion: 'notion.so',
  openai: 'openai.com',
  stripe: 'stripe.com',
}

const COMPANY_SUFFIXES = new Set([
  'ai',
  'co',
  'company',
  'corp',
  'corporation',
  'gmbh',
  'group',
  'inc',
  'incorporated',
  'labs',
  'llc',
  'ltd',
  'technologies',
  'technology',
])

function tokens(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(token => token && !COMPANY_SUFFIXES.has(token))
}

function rootDomain(domain: string) {
  return domain.toLowerCase().split('.').filter(Boolean)[0] ?? ''
}

function isConfidentMatch(company: string, result: ClearbitCompany) {
  if (!result.domain) return false

  const companyTokens = tokens(company)
  const resultTokens = tokens(result.name ?? '')
  const domainRoot = rootDomain(result.domain)
  if (companyTokens.length === 0) return false

  const primary = companyTokens[0]
  const tokenOverlap = companyTokens.filter(token => resultTokens.includes(token)).length
  const allTokensMatchName = companyTokens.every(token => resultTokens.includes(token))
  const domainContainsPrimary = primary.length >= 4 && domainRoot.includes(primary)
  const primaryMatchesDomain = primary.length >= 3 && domainRoot === primary

  return primaryMatchesDomain || (domainContainsPrimary && tokenOverlap > 0) || allTokensMatchName
}

export async function lookupDomain(company: string): Promise<string | null> {
  const key = company.trim().toLowerCase()
  if (!key) return null
  if (cache.has(key)) return cache.get(key)!
  if (MANUAL_DOMAINS[key]) {
    cache.set(key, MANUAL_DOMAINS[key])
    return MANUAL_DOMAINS[key]
  }

  try {
    const res  = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`)
    const data = await res.json() as ClearbitCompany[]
    const match = data.find(result => isConfidentMatch(company, result))
    const domain = match?.domain ?? null
    cache.set(key, domain)
    return domain
  } catch {
    cache.set(key, null)
    return null
  }
}

export async function linkedinJobsUrl(company: string, _position: string, savedUrl?: string | null): Promise<string> {
  if (savedUrl) return savedUrl
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(company)}&origin=JOB_SEARCH_PAGE_KEYWORD_AUTOCOMPLETE`
}
