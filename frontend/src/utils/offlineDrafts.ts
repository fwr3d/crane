import type { Job, Status } from '../types'

const KEY = 'crane.offlineJobDrafts.v1'

export type OfflineJobDraft = {
  id: string
  created_at: string
  company: string
  position: string
  status: Status
  url?: string
  deadline?: string
  notes?: string
}

export function getOfflineDrafts(): OfflineJobDraft[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OfflineJobDraft[]
  } catch {
    localStorage.removeItem(KEY)
    return []
  }
}

export function saveOfflineDraft(draft: Omit<OfflineJobDraft, 'id' | 'created_at'>) {
  const drafts = getOfflineDrafts()
  drafts.unshift({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...draft,
  })
  localStorage.setItem(KEY, JSON.stringify(drafts.slice(0, 100)))
}

export function jobToOfflineDraft(job: Pick<Job, 'company' | 'position' | 'status' | 'url' | 'deadline' | 'notes'>) {
  saveOfflineDraft({
    company: job.company,
    position: job.position,
    status: job.status,
    url: job.url || undefined,
    deadline: job.deadline || undefined,
    notes: job.notes || undefined,
  })
}
