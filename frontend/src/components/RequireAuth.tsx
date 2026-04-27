import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (!user || !profile?.name) return <Navigate to="/onboarding" replace />

  return children
}
