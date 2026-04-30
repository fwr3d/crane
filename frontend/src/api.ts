import type { Job, Stats, Status } from './types'
import { supabase } from './lib/supabase'

const API_ORIGIN = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8002' : '')
const BASE = `${API_ORIGIN}/api`

export type ScrapeFilters = {
  jobTypes?: string[]
  experienceLevels?: string[]
  workplaceTypes?: string[]
  datePosted?: string
  easyApply?: boolean
}

export type ScrapeEvent =
  | { type: 'page'; page: number; jobs: Job[]; total: number }
  | { type: 'rate_limited'; page: number; jobs: Job[]; message: string }
  | { type: 'done'; total: number }

const scrapeQuery = (search: string, location: string, filters?: ScrapeFilters) => {
  const q = new URLSearchParams({ search, location })
  filters?.jobTypes?.forEach(value => q.append('job_type', value))
  filters?.experienceLevels?.forEach(value => q.append('experience', value))
  filters?.workplaceTypes?.forEach(value => q.append('workplace', value))
  if (filters?.datePosted) q.set('date_posted', filters.datePosted)
  if (filters?.easyApply) q.set('easy_apply', 'true')
  return q
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const response = await fetch(input, { ...init, headers })

  if (response.status === 401) {
    window.dispatchEvent(new Event('crane:auth-invalid'))
    throw new Error('Your session has expired. Please sign in again.')
  }

  return response
}

async function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  jobs: {
    list: (params?: { search?: string; status?: string; sort?: string }): Promise<Job[]> => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.status) q.set('status', params.status)
      if (params?.sort)   q.set('sort',   params.sort)
      return apiFetch(`${BASE}/jobs?${q}`).then(jsonResponse<Job[]>)
    },
    create: (body: { company: string; position: string; status: Status; url?: string; notes?: string; deadline?: string }): Promise<Job> =>
      apiFetch(`${BASE}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(jsonResponse<Job>),
    update: (id: string, fields: { status?: Status; url?: string; notes?: string; deadline?: string }): Promise<Job> =>
      apiFetch(`${BASE}/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(jsonResponse<Job>),
    bulkUpdate: (ids: string[], status: Status): Promise<{ updated: number }> =>
      apiFetch(`${BASE}/jobs/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status }),
      }).then(jsonResponse<{ updated: number }>),
    delete: (id: string): Promise<void> =>
      apiFetch(`${BASE}/jobs/${id}`, { method: 'DELETE' }).then(() => undefined),
    clear: (): Promise<void> =>
      apiFetch(`${BASE}/jobs`, { method: 'DELETE' }).then(() => undefined),
  },
  stats: (): Promise<Stats> => apiFetch(`${BASE}/stats`).then(jsonResponse<Stats>),
  scrape: (search: string, location: string, filters?: ScrapeFilters): Promise<Job[]> => {
    const q = scrapeQuery(search, location, filters)

    return apiFetch(`${BASE}/scrape?${q}`, {
      method: 'POST',
    }).then(jsonResponse<Job[]>)
  },
  scrapeStream: async (
    search: string,
    location: string,
    filters: ScrapeFilters | undefined,
    onEvent: (event: ScrapeEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const q = scrapeQuery(search, location, filters)
    const response = await apiFetch(`${BASE}/scrape/stream?${q}`, {
      method: 'POST',
      signal,
    })
    if (!response.ok) throw new Error(`Scrape failed: ${response.status}`)
    if (!response.body) throw new Error('Scrape stream is not available')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        onEvent(JSON.parse(line) as ScrapeEvent)
      }
    }

    if (buffer.trim()) onEvent(JSON.parse(buffer) as ScrapeEvent)
  },
  exportCsv: async (): Promise<void> => {
    const response = await apiFetch(`${BASE}/export`)
    if (!response.ok) throw new Error(`Export failed: ${response.status}`)

    const blob = await response.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'crane-jobs.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  },
  exportUrl: `${BASE}/export`,
}
