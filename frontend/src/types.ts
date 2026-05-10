export type Status = 'Not Applied' | 'Applied' | 'Interview' | 'Offer' | 'Rejected'

export interface Job {
  id: string
  company: string
  position: string
  status: Status
  date_added?: string
  date_applied?: string
  url?: string
  location?: string
  job_id?: string
  source?: string
  logo_url?: string
  applicant_count?: number
  salary?: string
  job_type?: string
  tags?: string[]
  notes?: string
  deadline?: string
}

export interface Stats {
  total: number
  by_status: Record<Status, number>
  response_rate: number
  offer_rate: number
  stale: number
}

export interface AdvancedStats {
  funnel: Array<{ stage: Status; count: number; rate: number | null }>
  velocity: Array<{ label: string; count: number }>
  by_source: Array<{ source: string; total: number; replied: number; rate: number }>
  rejected: number
  avg_response_days: number | null
  response_count: number
}
