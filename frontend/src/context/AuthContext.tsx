import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth'
import type { Profile } from './auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

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
    await supabase.auth.signOut()
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
