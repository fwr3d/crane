import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type Profile = {
  id: string
  name: string | null
  target_role: string | null
  location: string | null
}

export type AuthContextType = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: Error | null; hasSession: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null; hasSession: boolean }>
  signOut: () => Promise<void>
  saveProfile: (data: Partial<Profile>) => Promise<void>
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
