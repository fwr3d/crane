import { useState, useEffect, useCallback } from 'react'
import type { Stats } from '../types'

export type TutorialStepId = 'add_job' | 'find_jobs' | 'change_status' | 'set_deadline'

export interface TutorialStep {
  id: TutorialStepId
  label: string
  description: string
  target: string // data-tutorial-id value
  done: boolean
}

const STORAGE_KEY = 'crane_tutorial_v1'

interface Stored {
  dismissed: boolean
  manualDone: TutorialStepId[]
}

function load(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return { dismissed: false, manualDone: [] }
  }
}

function save(data: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useTutorial(stats: Stats | null) {
  const [stored, setStored] = useState<Stored>(load)
  const [spotlight, setSpotlightState] = useState<TutorialStepId | null>(null)

  // Sync stored state to localStorage whenever it changes
  useEffect(() => { save(stored) }, [stored])

  const markDone = useCallback((id: TutorialStepId) => {
    setStored(prev => {
      if (prev.manualDone?.includes(id)) return prev
      return { ...prev, manualDone: [...(prev.manualDone ?? []), id] }
    })
  }, [])

  const dismiss = useCallback(() => {
    setStored(prev => ({ ...prev, dismissed: true }))
    setSpotlightState(null)
  }, [])

  const setSpotlight = useCallback((id: TutorialStepId | null) => {
    setSpotlightState(id)
  }, [])

  const manualDone = new Set(stored.manualDone ?? [])

  const steps: TutorialStep[] = [
    {
      id: 'add_job',
      label: 'Add your first job',
      description: 'Click "+ Add a job" to manually add a job you want to apply to.',
      target: 'add-job-btn',
      done: (stats?.total ?? 0) > 0 || manualDone.has('add_job'),
    },
    {
      id: 'find_jobs',
      label: 'Search LinkedIn for jobs',
      description: 'Use the Find page to scrape LinkedIn and import jobs directly.',
      target: 'find-nav',
      done: manualDone.has('find_jobs'),
    },
    {
      id: 'change_status',
      label: 'Update a job\'s status',
      description: 'Click the status pill on any job to move it through your pipeline.',
      target: 'status-pill',
      done: manualDone.has('change_status'),
    },
    {
      id: 'set_deadline',
      label: 'Set an application deadline',
      description: 'Open a job and add a deadline to get reminders before it passes.',
      target: 'deadline-field',
      done: manualDone.has('set_deadline'),
    },
  ]

  const allDone = steps.every(s => s.done)

  return {
    steps,
    allDone,
    dismissed: stored.dismissed ?? false,
    spotlight,
    setSpotlight,
    dismiss,
    markDone,
  }
}
