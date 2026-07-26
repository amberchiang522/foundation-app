import { supabase } from '@/lib/supabase'
import type { User, VolunteerApplication } from '@/types'

function transformUser(row: any, adminTags: string[] = []): User {
  return {
    id: row.id,
    volunteerNumber: row.volunteer_number || '',
    type: row.type,
    role: row.role,
    adminTags,
    name: row.name,
    email: row.email,
    phone: row.phone,
    birthday: row.birthday,
    occupation: row.occupation || '',
    experience: row.experience || '',
    lineId: row.line_id || '',
    avatar: row.avatar,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function transformApplication(row: any): VolunteerApplication {
  return {
    id: row.id,
    token: row.token,
    name: row.name,
    email: row.email,
    phone: row.phone,
    birthday: row.birthday,
    occupation: row.occupation || '',
    experience: row.experience || '',
    lineId: row.line_id || '',
    status: row.status,
    reviewNote: row.review_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const supabaseUserService = {
  // Users
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
    return data.map(row => transformUser(row))
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

    // Get admin tags if admin
    let adminTags: string[] = []
    if (data.role === 'admin') {
      const { data: tags } = await supabase
        .from('user_admin_tags')
        .select('tag_id')
        .eq('user_id', id)
      if (tags) {
        adminTags = tags.map(t => t.tag_id)
      }
    }

    return transformUser(data, adminTags)
  },

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.birthday !== undefined) updateData.birthday = data.birthday
    if (data.occupation !== undefined) updateData.occupation = data.occupation
    if (data.experience !== undefined) updateData.experience = data.experience
    if (data.lineId !== undefined) updateData.line_id = data.lineId
    if (data.avatar !== undefined) updateData.avatar = data.avatar
    if (data.status !== undefined) updateData.status = data.status

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
    return transformUser(updated)
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
    return data.map(transformApplication)
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
    return transformApplication(data)
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
    return transformApplication(data)
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
    return transformApplication(data)
  },

  async createApplication(data: Omit<VolunteerApplication, 'id' | 'token' | 'status' | 'createdAt' | 'updatedAt'>): Promise<VolunteerApplication> {
    const { data: newApp, error } = await supabase
      .from('volunteer_applications')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        birthday: data.birthday,
        occupation: data.occupation,
        experience: data.experience,
        line_id: data.lineId,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating application:', error)
      throw error
    }
    return transformApplication(newApp)
  },

  async updateApplication(id: string, data: Partial<VolunteerApplication>): Promise<VolunteerApplication | null> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.birthday !== undefined) updateData.birthday = data.birthday
    if (data.occupation !== undefined) updateData.occupation = data.occupation
    if (data.experience !== undefined) updateData.experience = data.experience
    if (data.lineId !== undefined) updateData.line_id = data.lineId
    if (data.status !== undefined) updateData.status = data.status
    if (data.reviewNote !== undefined) updateData.review_note = data.reviewNote
    if (data.reviewedBy !== undefined) updateData.reviewed_by = data.reviewedBy
    if (data.reviewedAt !== undefined) updateData.reviewed_at = data.reviewedAt

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
    return transformApplication(updated)
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

    // Note: User creation in Supabase requires using the admin API or inviting the user
    // For now, we'll just mark the application as approved
    // The actual user account creation should be handled separately
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
