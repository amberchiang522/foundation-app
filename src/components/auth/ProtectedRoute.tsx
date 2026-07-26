import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireSuperAdmin?: boolean
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isSuperAdmin, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login page with return URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    // Redirect to dashboard if not super admin
    return <Navigate to="/dashboard" replace />
  }

  if (requireAdmin && !isAdmin) {
    // Redirect to dashboard if not admin
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
