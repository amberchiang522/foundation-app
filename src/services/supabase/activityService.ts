import { supabase } from '@/lib/supabase'
import type { Activity, ActivityRegistration } from '@/types'

function transformActivity(row: any): Activity {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description || '',
    date: row.date,
    location: row.location || '',
    type: row.type || '',
    coverImage: row.cover_image,
    contentImages: row.content_images || [],
    capacity: row.capacity,
    registrationMode: row.registration_mode,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function transformRegistration(row: any): ActivityRegistration {
  return {
    id: row.id,
    activityId: row.activity_id,
    userId: row.user_id,
    status: row.status,
    waitlistPosition: row.waitlist_position,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    attended: row.attended,
    serviceHours: row.service_hours,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const supabaseActivityService = {
  // Activities
  async getActivities(): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching activities:', error)
      return []
    }
    return data.map(transformActivity)
  },

  async getUpcomingActivities(): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .in('status', ['upcoming', 'ongoing'])
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching upcoming activities:', error)
      return []
    }
    return data.map(transformActivity)
  },

  async getPastActivities(): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .in('status', ['completed', 'archived'])
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching past activities:', error)
      return []
    }
    return data.map(transformActivity)
  },

  async getActivityById(id: string): Promise<Activity | null> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching activity:', error)
      return null
    }
    return transformActivity(data)
  },

  async createActivity(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Activity> {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id

    const { data: newActivity, error } = await supabase
      .from('activities')
      .insert({
        project_id: data.projectId,
        name: data.name,
        description: data.description,
        date: data.date,
        location: data.location,
        type: data.type,
        cover_image: data.coverImage,
        content_images: data.contentImages,
        capacity: data.capacity,
        registration_mode: data.registrationMode,
        status: data.status,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating activity:', error)
      throw error
    }
    return transformActivity(newActivity)
  },

  async updateActivity(id: string, data: Partial<Activity>): Promise<Activity | null> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.date !== undefined) updateData.date = data.date
    if (data.location !== undefined) updateData.location = data.location
    if (data.type !== undefined) updateData.type = data.type
    if (data.coverImage !== undefined) updateData.cover_image = data.coverImage
    if (data.contentImages !== undefined) updateData.content_images = data.contentImages
    if (data.capacity !== undefined) updateData.capacity = data.capacity
    if (data.registrationMode !== undefined) updateData.registration_mode = data.registrationMode
    if (data.status !== undefined) updateData.status = data.status

    const { data: updated, error } = await supabase
      .from('activities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating activity:', error)
      return null
    }
    return transformActivity(updated)
  },

  async archiveActivity(id: string): Promise<Activity | null> {
    return this.updateActivity(id, { status: 'archived' })
  },

  // Registrations
  async getRegistrationsByActivity(activityId: string): Promise<ActivityRegistration[]> {
    const { data, error } = await supabase
      .from('activity_registrations')
      .select('*')
      .eq('activity_id', activityId)

    if (error) {
      console.error('Error fetching registrations:', error)
      return []
    }
    return data.map(transformRegistration)
  },

  async getRegistrationsByUser(userId: string): Promise<ActivityRegistration[]> {
    const { data, error } = await supabase
      .from('activity_registrations')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user registrations:', error)
      return []
    }
    return data.map(transformRegistration)
  },

  async getRegistration(activityId: string, userId: string): Promise<ActivityRegistration | null> {
    const { data, error } = await supabase
      .from('activity_registrations')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      console.error('Error fetching registration:', error)
      return null
    }
    return transformRegistration(data)
  },

  async registerForActivity(activityId: string, userId: string): Promise<ActivityRegistration | null> {
    const activity = await this.getActivityById(activityId)
    if (!activity) return null

    // Check if already registered
    const existing = await this.getRegistration(activityId, userId)
    if (existing) return existing

    // Count confirmed registrations
    const { count } = await supabase
      .from('activity_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('activity_id', activityId)
      .eq('status', 'confirmed')

    // Determine status
    let status: ActivityRegistration['status'] = 'confirmed'
    let waitlistPosition: number | undefined

    if ((count || 0) >= activity.capacity) {
      status = 'waitlist'
      const { count: waitlistCount } = await supabase
        .from('activity_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', activityId)
        .eq('status', 'waitlist')
      waitlistPosition = (waitlistCount || 0) + 1
    } else if (activity.registrationMode === 'approval') {
      status = 'pending'
    }

    const { data: newReg, error } = await supabase
      .from('activity_registrations')
      .insert({
        activity_id: activityId,
        user_id: userId,
        status,
        waitlist_position: waitlistPosition,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating registration:', error)
      return null
    }
    return transformRegistration(newReg)
  },

  async cancelRegistration(activityId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('activity_registrations')
      .update({ status: 'cancelled' })
      .eq('activity_id', activityId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error cancelling registration:', error)
      return false
    }
    return true
  },

  async approveRegistration(registrationId: string, reviewerId: string): Promise<ActivityRegistration | null> {
    const { data, error } = await supabase
      .from('activity_registrations')
      .update({
        status: 'confirmed',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single()

    if (error) {
      console.error('Error approving registration:', error)
      return null
    }
    return transformRegistration(data)
  },

  async recordAttendance(registrationId: string, attended: boolean, serviceHours?: number): Promise<ActivityRegistration | null> {
    const { data, error } = await supabase
      .from('activity_registrations')
      .update({
        attended,
        service_hours: serviceHours,
      })
      .eq('id', registrationId)
      .select()
      .single()

    if (error) {
      console.error('Error recording attendance:', error)
      return null
    }
    return transformRegistration(data)
  },

  // Stats
  async getStats(): Promise<{ totalActivities: number; upcomingCount: number; completedCount: number }> {
    const { count: total } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })

    const { count: upcoming } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .in('status', ['upcoming', 'ongoing'])

    const { count: completed } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    return {
      totalActivities: total || 0,
      upcomingCount: upcoming || 0,
      completedCount: completed || 0,
    }
  },

  async getUserServiceHours(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('activity_registrations')
      .select('service_hours')
      .eq('user_id', userId)
      .eq('attended', true)

    if (error) {
      console.error('Error fetching service hours:', error)
      return 0
    }
    return data.reduce((sum, r) => sum + (r.service_hours || 0), 0)
  },
}
