export type Status = 'Not Applied' | 'Applied' | 'Interview' | 'Offer' | 'Rejected'

export interface Job {
  id: string
  company: string
  position: string
  status: Status
  date_added?: string
  date_applied?: string
}

export interface Stats {
  total: number
  by_status: Record<Status, number>
  response_rate: number
  offer_rate: number
}
