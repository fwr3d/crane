import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Job, Status } from '../types'
import { StatusBadge } from '../components/StatusBadge'

const STATUSES: Status[] = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

export function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set(STATUSES))
  const [sort, setSort] = useState('date_desc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<Status>('Not Applied')

  const load = () =>
    api.jobs.list({
      search,
      status: [...statusFilter].join(','),
      sort,
    }).then(setJobs)

  useEffect(() => { load() }, [search, statusFilter, sort])

  const toggleStatus = (s: Status) => {
    setStatusFilter(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const startEdit = (job: Job) => {
    setEditingId(job.id)
    setEditStatus(job.status)
  }

  const saveEdit = async (id: string) => {
    await api.jobs.update(id, editStatus)
    setEditingId(null)
    load()
  }

  const remove = async (id: string) => {
    await api.jobs.delete(id)
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">All Jobs</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-slate-400 bg-white"
          placeholder="Search company or position..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-slate-400"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="date_desc">Date added</option>
          <option value="company">Company A-Z</option>
          <option value="status">Status</option>
        </select>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              statusFilter.has(s)
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400">{jobs.length} jobs</p>

      {/* Job list */}
      <div className="space-y-2">
        {jobs.map(job => (
          <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
            {editingId === job.id ? (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{job.position}</p>
                  <p className="text-xs text-slate-400">{job.company}</p>
                </div>
                <select
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:border-slate-400"
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as Status)}
                >
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <button
                  onClick={() => saveEdit(job.id)}
                  className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:border-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{job.position}</p>
                  <p className="text-xs text-slate-400 truncate">{job.company}</p>
                </div>
                <StatusBadge status={job.status} />
                {job.date_added && (
                  <span className="text-xs text-slate-300 hidden sm:block shrink-0">{job.date_added}</span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(job)}
                    className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(job.id)}
                    className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {jobs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-12">No jobs found.</p>
        )}
      </div>
    </div>
  )
}
