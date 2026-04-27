import { supabase } from './supabase'
import type { Job, Stats, Status } from '../types'

export const jobsApi = {
  list: async (params?: { search?: string; status?: string; sort?: string }): Promise<Job[]> => {
    let query = supabase.from('jobs').select('*')

    if (params?.search) {
      const s = params.search
      query = query.or(`company.ilike.%${s}%,position.ilike.%${s}%`)
    }

    const allStatuses = 'Not Applied,Applied,Interview,Offer,Rejected'
    if (params?.status && params.status !== allStatuses) {
      query = query.in('status', params.status.split(','))
    }

    switch (params?.sort) {
      case 'company':  query = query.order('company', { ascending: true }); break
      case 'status':   query = query.order('status',  { ascending: true }); break
      case 'deadline': query = query.order('deadline', { ascending: true, nullsFirst: false }); break
      default:         query = query.order('date_added', { ascending: false })
    }

    const { data } = await query
    return (data ?? []) as Job[]
  },

  create: async (body: { company: string; position: string; status: Status; url?: string; notes?: string; deadline?: string }): Promise<Job> => {
    const { data } = await supabase.from('jobs').insert(body).select().single()
    return data as Job
  },

  update: async (id: string, fields: Partial<Job>): Promise<Job> => {
    const { data } = await supabase.from('jobs').update(fields).eq('id', id).select().single()
    return data as Job
  },

  bulkUpdate: async (ids: string[], status: Status): Promise<{ updated: number }> => {
    const { data } = await supabase.from('jobs').update({ status }).in('id', ids).select()
    return { updated: data?.length ?? 0 }
  },

  delete: async (id: string): Promise<void> => {
    await supabase.from('jobs').delete().eq('id', id)
  },

  clear: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('jobs').delete().eq('user_id', user.id)
  },

  stats: async (): Promise<Stats> => {
    const { data } = await supabase.from('jobs').select('status,date_applied,date_added')
    const jobs = (data ?? []) as Pick<Job, 'status' | 'date_applied' | 'date_added'>[]

    const by_status = { 'Not Applied': 0, 'Applied': 0, 'Interview': 0, 'Offer': 0, 'Rejected': 0 } as Record<Status, number>
    for (const j of jobs) {
      if (j.status in by_status) by_status[j.status as Status]++
    }

    const total    = jobs.length
    const inFlight = by_status['Applied'] + by_status['Interview'] + by_status['Offer']
    const response_rate = inFlight > 0 ? Math.round(((by_status['Interview'] + by_status['Offer']) / inFlight) * 100) : 0
    const offer_rate    = inFlight > 0 ? Math.round((by_status['Offer'] / inFlight) * 100) : 0

    const stale = jobs.filter(j => {
      if (!['Applied', 'Interview'].includes(j.status)) return false
      const ref = j.date_applied ?? j.date_added
      return ref ? (Date.now() - new Date(ref).getTime()) / 86400000 > 14 : false
    }).length

    return { total, by_status, response_rate, offer_rate, stale }
  },

  exportCsv: async (): Promise<void> => {
    const { data } = await supabase.from('jobs').select('*').order('date_added', { ascending: false })
    if (!data || data.length === 0) return
    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(j => Object.values(j).map(v => `"${v ?? ''}"`).join(','))
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'crane-jobs.csv'
    a.click()
  },
}
