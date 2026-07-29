import { supabase } from '@/lib/supabase'
import type { User, VolunteerApplication } from '@/types'

function transformUser(row: Record<string, unknown>, adminTags: string[] = []): User {
  return {
    id: row.id as string,
    volunteerNumber: (row.volunteer_number as string) || '',
    type: row.type as User['type'],
    role: row.role as User['role'],
    adminTags,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    birthday: row.birthday as string,
    occupation: (row.occupation as string) || '',
    experience: (row.experience as string) || '',
    lineId: (row.line_id as string) || '',
    avatar: row.avatar as User['avatar'],
    status: row.status as User['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function transformApplication(row: Record<string, unknown>): VolunteerApplication {
  return {
    id: row.id as string,
    token: row.token as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    birthday: row.birthday as string,
    occupation: (row.occupation as string) || '',
    experience: (row.experience as string) || '',
    lineId: (row.line_id as string) || '',
    status: row.status as VolunteerApplication['status'],
    reviewNote: row.review_note as string | undefined,
    reviewedBy: row.reviewed_by as string | undefined,
    reviewedAt: row.reviewed_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export const supabaseUserService = {
  // Users - get only volunteers
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'volunteer')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return []
    }
    return (data || []).map(row => transformUser(row as Record<string, unknown>))
  },

  // Get admin staff (admins, super_admins) for assignment
  async getAllStaff(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'active')
      .in('role', ['admin', 'super_admin'])
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching staff:', error)
      return []
    }
    return (data || []).map(row => transformUser(row as Record<string, unknown>))
  },

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    const row = data as Record<string, unknown>

    // Get admin tags if admin
    let adminTags: string[] = []
    if (row.role === 'admin') {
      const { data: tags } = await supabase
        .from('user_admin_tags')
        .select('tag_id')
        .eq('user_id', id)
      if (tags) {
        adminTags = tags.map(t => (t as Record<string, unknown>).tag_id as string)
      }
    }

    return transformUser(row, adminTags)
  },

  async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
    const updateData: Record<string, unknown> = {}
    if (userData.name !== undefined) updateData.name = userData.name
    if (userData.phone !== undefined) updateData.phone = userData.phone
    if (userData.birthday !== undefined) updateData.birthday = userData.birthday
    if (userData.occupation !== undefined) updateData.occupation = userData.occupation
    if (userData.experience !== undefined) updateData.experience = userData.experience
    if (userData.lineId !== undefined) updateData.line_id = userData.lineId
    if (userData.avatar !== undefined) updateData.avatar = userData.avatar
    if (userData.status !== undefined) updateData.status = userData.status

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return null
    }
    return transformUser(updated as Record<string, unknown>)
  },

  async suspendUser(id: string): Promise<User | null> {
    return this.updateUser(id, { status: 'suspended' })
  },

  async activateUser(id: string): Promise<User | null> {
    return this.updateUser(id, { status: 'active' })
  },

  // Applications
  async getApplications(): Promise<VolunteerApplication[]> {
    const { data, error } = await supabase
      .from('volunteer_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching applications:', error)
      return []
    }
    return (data || []).map(row => transformApplication(row as Record<string, unknown>))
  },

  async getApplicationById(id: string): Promise<VolunteerApplication | null> {
    const { data, error } = await supabase
      .from('volunteer_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching application:', error)
      return null
    }
    return transformApplication(data as Record<string, unknown>)
  },

  async getApplicationByToken(token: string): Promise<VolunteerApplication | null> {
    const { data, error } = await supabase
      .from('volunteer_applications')
      .select('*')
      .eq('token', token)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('Error fetching application by token:', error)
      return null
    }
    return transformApplication(data as Record<string, unknown>)
  },

  async getApplicationByEmail(email: string): Promise<VolunteerApplication | null> {
    const { data, error } = await supabase
      .from('volunteer_applications')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('Error fetching application by email:', error)
      return null
    }
    return transformApplication(data as Record<string, unknown>)
  },

  async createApplication(appData: Omit<VolunteerApplication, 'id' | 'token' | 'status' | 'createdAt' | 'updatedAt'>): Promise<VolunteerApplication> {
    const { data: newApp, error } = await supabase
      .from('volunteer_applications')
      .insert({
        name: appData.name,
        email: appData.email,
        phone: appData.phone,
        birthday: appData.birthday,
        occupation: appData.occupation,
        experience: appData.experience,
        line_id: appData.lineId,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating application:', error)
      throw error
    }
    return transformApplication(newApp as Record<string, unknown>)
  },

  async updateApplication(id: string, appData: Partial<VolunteerApplication>): Promise<VolunteerApplication | null> {
    const updateData: Record<string, unknown> = {}
    if (appData.name !== undefined) updateData.name = appData.name
    if (appData.email !== undefined) updateData.email = appData.email
    if (appData.phone !== undefined) updateData.phone = appData.phone
    if (appData.birthday !== undefined) updateData.birthday = appData.birthday
    if (appData.occupation !== undefined) updateData.occupation = appData.occupation
    if (appData.experience !== undefined) updateData.experience = appData.experience
    if (appData.lineId !== undefined) updateData.line_id = appData.lineId
    if (appData.status !== undefined) updateData.status = appData.status
    if (appData.reviewNote !== undefined) updateData.review_note = appData.reviewNote
    if (appData.reviewedBy !== undefined) updateData.reviewed_by = appData.reviewedBy
    if (appData.reviewedAt !== undefined) updateData.reviewed_at = appData.reviewedAt

    const { data: updated, error } = await supabase
      .from('volunteer_applications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating application:', error)
      return null
    }
    return transformApplication(updated as Record<string, unknown>)
  },

  async approveApplication(id: string, reviewerId: string): Promise<User | null> {
    const application = await this.getApplicationById(id)
    if (!application) return null

    // Update application status
    await this.updateApplication(id, {
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    })

    console.log(`Application approved. User should be created with email: ${application.email}`)
    return null
  },

  async rejectApplication(id: string, reviewerId: string, reason: string): Promise<VolunteerApplication | null> {
    return this.updateApplication(id, {
      status: 'rejected',
      reviewNote: reason,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    })
  },

  async requestRevision(id: string, reviewerId: string, note: string): Promise<VolunteerApplication | null> {
    return this.updateApplication(id, {
      status: 'needs_revision',
      reviewNote: note,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    })
  },

  // Stats
  async getStats(): Promise<{ totalVolunteers: number; youthCount: number; socialCount: number; pendingApplications: number }> {
    const { count: totalVolunteers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'volunteer')

    const { count: youthCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'volunteer')
      .eq('type', 'youth')

    const { count: socialCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'volunteer')
      .eq('type', 'social')

    const { count: pendingApplications } = await supabase
      .from('volunteer_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    return {
      totalVolunteers: totalVolunteers || 0,
      youthCount: youthCount || 0,
      socialCount: socialCount || 0,
      pendingApplications: pendingApplications || 0,
    }
  },
}
