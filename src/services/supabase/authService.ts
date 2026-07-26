import { supabase } from '@/lib/supabase'
import type { User } from '@/types'
import type { AuthResult, LoginCredentials } from '../authService'

// Transform database profile to User type
function transformProfile(profile: any, adminTags: string[] = []): User {
  return {
    id: profile.id,
    volunteerNumber: profile.volunteer_number || '',
    type: profile.type,
    role: profile.role,
    adminTags: adminTags,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    birthday: profile.birthday,
    occupation: profile.occupation || '',
    experience: profile.experience || '',
    lineId: profile.line_id || '',
    avatar: profile.avatar || undefined,
    status: profile.status,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

export const supabaseAuthService = {
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    console.log('Attempting login for:', credentials.email)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      console.log('Supabase response - data:', data)
      console.log('Supabase response - error:', error)

      if (error) {
        console.error('Supabase auth error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
          stack: error.stack,
        })
        // Translate common errors to Chinese
        if (error.message?.includes('Invalid login credentials')) {
          return { success: false, error: '帳號或密碼錯誤' }
        }
        if (error.message?.includes('Email not confirmed')) {
          return { success: false, error: '請先驗證您的 Email' }
        }
        // Show actual error for debugging
        const errorMsg = error.message || error.code || `Status: ${error.status}` || JSON.stringify(error)
        return { success: false, error: `登入失敗: ${errorMsg}` }
      }

      if (!data.user) {
        return { success: false, error: '登入失敗' }
      }

      // Get user profile with admin tags
      const user = await this.getCurrentUser()
      if (!user) {
        return { success: false, error: '無法取得使用者資料' }
      }

      if (user.status === 'suspended') {
        await supabase.auth.signOut()
        return { success: false, error: '此帳號已被停權' }
      }

      return { success: true, user }
    } catch (err) {
      console.error('Unexpected login error:', err)
      return { success: false, error: `登入失敗: ${err instanceof Error ? err.message : String(err)}` }
    }
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return null
    }

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Failed to get profile:', profileError)
      return null
    }

    // Get admin tags if user is admin
    let adminTags: string[] = []
    if (profile.role === 'admin') {
      const { data: tags } = await supabase
        .from('user_admin_tags')
        .select('tag_id')
        .eq('user_id', session.user.id)

      if (tags) {
        adminTags = tags.map(t => t.tag_id)
      }
    }

    return transformProfile(profile, adminTags)
  },

  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession()
    return session !== null
  },

  async isAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user?.role === 'admin'
  },

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const user = await this.getCurrentUser()
        callback(user)
      } else if (event === 'SIGNED_OUT') {
        callback(null)
      }
    })
  },

  // Get session for API calls
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },
}
