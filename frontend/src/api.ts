import type { Job, Stats, Status } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export const api = {
  jobs: {
    list: (params?: { search?: string; status?: string; sort?: string }): Promise<Job[]> => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.status) q.set('status', params.status)
      if (params?.sort) q.set('sort', params.sort)
      return fetch(`${BASE}/jobs?${q}`).then(r => r.json())
    },
    create: (body: { company: string; position: string; status: Status }): Promise<Job> =>
      fetch(`${BASE}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    update: (id: string, status: Status): Promise<Job> =>
      fetch(`${BASE}/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    delete: (id: string): Promise<void> =>
      fetch(`${BASE}/jobs/${id}`, { method: 'DELETE' }).then(() => undefined),
  },
  stats: (): Promise<Stats> => fetch(`${BASE}/stats`).then(r => r.json()),
  scrape: (search: string, location: string): Promise<Job[]> =>
    fetch(`${BASE}/scrape?search=${encodeURIComponent(search)}&location=${encodeURIComponent(location)}`, {
      method: 'POST',
    }).then(r => r.json()),
  exportUrl: `${BASE}/export`,
}
