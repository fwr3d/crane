import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const projectRef = new URL(url).hostname.split('.')[0]
const authStorageKey = `sb-${projectRef}-auth-token`

export function clearRememberedSupabaseSession() {
  localStorage.removeItem(authStorageKey)
}

clearRememberedSupabaseSession()

export const supabase = createClient(url, key, {
  auth: {
    storage: sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})
