import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { clearPersistedSupabaseSession, supabase } from '../lib/supabase'
import { AuthContext } from './auth'
import type { Profile } from './auth'

const API_ORIGIN = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8002' : '')
const AUTH_VALIDATE_URL = `${API_ORIGIN}/api/auth/validate`

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const clearLocalAuth = useCallback(async () => {
    setSession(null)
    setUser(null)
    setProfile(null)
    setLoading(false)
    clearPersistedSupabaseSession()
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }, [])

  const profileFromUser = useCallback((currentUser: User): Profile | null => {
    const meta = currentUser.user_metadata
    if (!meta.name && !meta.target_role && !meta.location) return null

    return {
      id: currentUser.id,
      name: typeof meta.name === 'string' ? meta.name : null,
      target_role: typeof meta.target_role === 'string' ? meta.target_role : null,
      location: typeof meta.location === 'string' ? meta.location : null,
    }
  }, [])

  const fetchProfile = useCallback(async (currentUser: User) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
    setProfile(error ? profileFromUser(currentUser) : (data ?? profileFromUser(currentUser)))
    setLoading(false)
  }, [profileFromUser])

  const applySession = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setSession(null)
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      await clearLocalAuth()
      return
    }

    const response = await fetch(AUTH_VALIDATE_URL, {
      headers: { Authorization: `Bearer ${nextSession.access_token}` },
    }).catch(() => null)
    if (!response?.ok) {
      await clearLocalAuth()
      return
    }

    setSession(nextSession)
    setUser(data.user)
    await fetchProfile(data.user)
  }, [clearLocalAuth, fetchProfile])

  useEffect(() => {
    clearPersistedSupabaseSession()
    setLoading(false)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => subscription.unsubscribe()
  }, [applySession])

  useEffect(() => {
    const validateCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await applySession(session)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') validateCurrentSession()
    }
    const handleAuthInvalid = () => { clearLocalAuth() }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', validateCurrentSession)
    window.addEventListener('crane:auth-invalid', handleAuthInvalid)
    const interval = window.setInterval(validateCurrentSession, 60000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', validateCurrentSession)
      window.removeEventListener('crane:auth-invalid', handleAuthInvalid)
      window.clearInterval(interval)
    }
  }, [applySession, clearLocalAuth])

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
      await fetchProfile(data.session.user)
    }
    return { error: error as Error | null, hasSession: Boolean(data.session) }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
      await fetchProfile(data.session.user)
    }
    return { error: error as Error | null, hasSession: Boolean(data.session) }
  }

  async function signOut() {
    await supabase.auth.signOut().catch(() => undefined)
    await clearLocalAuth()
  }

  async function saveProfile(data: Partial<Profile>) {
    const { data: authData } = user ? { data: { user } } : await supabase.auth.getUser()
    const currentUser = authData.user
    if (!currentUser) throw new Error('Please sign in before saving your profile.')

    const nextProfile = {
      id: currentUser.id,
      name: data.name ?? profile?.name ?? null,
      target_role: data.target_role ?? profile?.target_role ?? null,
      location: data.location ?? profile?.location ?? null,
    }

    const { data: updatedAuth, error: authError } = await supabase.auth.updateUser({
      data: {
        name: nextProfile.name,
        target_role: nextProfile.target_role,
        location: nextProfile.location,
      },
    })
    if (authError) throw authError

    await supabase.from('profiles').upsert(nextProfile)

    setUser(updatedAuth.user ?? currentUser)
    setProfile(nextProfile)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, saveProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
