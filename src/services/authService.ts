import { supabaseAuthService } from './supabase/authService'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResult {
  success: boolean
  user?: import('@/types').User
  error?: string
}

// Export Supabase auth service directly
export const authService = supabaseAuthService
