import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const projectRef = new URL(url).hostname.split('.')[0]
const authStorageKey = `sb-${projectRef}-auth-token`

export function clearPersistedSupabaseSession() {
  localStorage.removeItem(authStorageKey)
}

clearPersistedSupabaseSession()

export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
  },
})
