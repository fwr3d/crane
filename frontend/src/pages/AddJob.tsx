import { useState } from 'react'
import { api } from '../api'
import type { Status } from '../types'

const STATUSES: Status[] = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

export function AddJob() {
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [status, setStatus] = useState<Status>('Not Applied')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company.trim() || !position.trim()) return
    setLoading(true)
    await api.jobs.create({ company, position, status })
    setCompany('')
    setPosition('')
    setStatus('Not Applied')
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold text-slate-900">Add Job</h1>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5">Company</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-400 transition-colors"
            placeholder="e.g. Stripe"
            value={company}
            onChange={e => setCompany(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5">Position</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-400 transition-colors"
            placeholder="e.g. Software Engineer"
            value={position}
            onChange={e => setPosition(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  status === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Adding...' : 'Add Job'}
        </button>

        {saved && (
          <p className="text-xs text-emerald-600 text-center font-medium">Job added.</p>
        )}
      </form>
    </div>
  )
}
