import type { Job, Stats, Status } from './types'
import { supabase } from './lib/supabase'

const API_ORIGIN = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8002' : '')
const BASE = `${API_ORIGIN}/api`

const authHeader = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

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

export const api = {
  jobs: {
    list: async (params?: { search?: string; status?: string; sort?: string }): Promise<Job[]> => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.status) q.set('status', params.status)
      if (params?.sort)   q.set('sort',   params.sort)
      const h = await authHeader()
      return fetch(`${BASE}/jobs?${q}`, { headers: h }).then(r => r.json())
    },
    create: async (body: { company: string; position: string; status: Status; url?: string; notes?: string; deadline?: string }): Promise<Job> => {
      const h = await authHeader()
      return fetch(`${BASE}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify(body),
      }).then(r => r.json())
    },
    update: async (id: string, fields: { status?: Status; url?: string; notes?: string; deadline?: string }): Promise<Job> => {
      const h = await authHeader()
      return fetch(`${BASE}/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify(fields),
      }).then(r => r.json())
    },
    bulkUpdate: async (ids: string[], status: Status): Promise<{ updated: number }> => {
      const h = await authHeader()
      return fetch(`${BASE}/jobs/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ ids, status }),
      }).then(r => r.json())
    },
    delete: async (id: string): Promise<void> => {
      const h = await authHeader()
      return fetch(`${BASE}/jobs/${id}`, { method: 'DELETE', headers: h }).then(() => undefined)
    },
    clear: async (): Promise<void> => {
      const h = await authHeader()
      return fetch(`${BASE}/jobs`, { method: 'DELETE', headers: h }).then(() => undefined)
    },
  },
  stats: async (): Promise<Stats> => {
    const h = await authHeader()
    return fetch(`${BASE}/stats`, { headers: h }).then(r => r.json())
  },
  scrape: (search: string, location: string, filters?: ScrapeFilters): Promise<Job[]> => {
    const q = scrapeQuery(search, location, filters)
    return fetch(`${BASE}/scrape?${q}`, { method: 'POST' }).then(r => r.json())
  },
  scrapeStream: async (
    search: string,
    location: string,
    filters: ScrapeFilters | undefined,
    onEvent: (event: ScrapeEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const q = scrapeQuery(search, location, filters)
    const response = await fetch(`${BASE}/scrape/stream?${q}`, {
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
  exportUrl: `${BASE}/export`,
}
