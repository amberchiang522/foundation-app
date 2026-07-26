import type { User } from '@/types'
import { mockUsers } from '@/data/mockData'
import { useSupabase } from '@/lib/supabase'
import { supabaseAuthService } from './supabase/authService'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

// Mock auth service
const mockAuthService = {
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    const user = mockUsers.find(u => u.email === credentials.email)

    if (!user) {
      return { success: false, error: '找不到此帳號' }
    }

    // Check password (phone number is default password)
    if (credentials.password !== user.phone) {
      return { success: false, error: '密碼錯誤' }
    }

    if (user.status === 'suspended') {
      return { success: false, error: '此帳號已被停權' }
    }

    // Store user in localStorage for mock session
    localStorage.setItem('currentUser', JSON.stringify(user))

    return { success: true, user }
  },

  async logout(): Promise<void> {
    localStorage.removeItem('currentUser')
  },

  async getCurrentUser(): Promise<User | null> {
    const stored = localStorage.getItem('currentUser')
    if (!stored) return null

    try {
      return JSON.parse(stored) as User
    } catch {
      return null
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user !== null
  },

  async isAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user?.role === 'admin'
  },
}

// Export the appropriate auth service based on feature flag
export const authService = useSupabase ? supabaseAuthService : mockAuthService
