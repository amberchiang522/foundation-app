import { supabase } from '@/lib/supabase'
import type { Activity, ActivityRegistration } from '@/types'

function transformActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    projectId: row.project_id as string | undefined,
    name: row.name as string,
    description: (row.description as string) || '',
    date: row.date as string,
    location: (row.location as string) || '',
    locationUrl: (row.location_url as string) || undefined,
    type: (row.type as string) || '',
    coverImage: row.cover_image as Activity['coverImage'],
    contentImages: (row.content_images as Activity['contentImages']) || [],
    capacity: row.capacity as number,
    registrationMode: row.registration_mode as Activity['registrationMode'],
    status: row.status as Activity['status'],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function transformRegistration(row: Record<string, unknown>): ActivityRegistration {
  return {
    id: row.id as string,
    activityId: row.activity_id as string,
    userId: row.user_id as string,
    status: row.status as ActivityRegistration['status'],
    waitlistPosition: row.waitlist_position as number | undefined,
    reviewedBy: row.reviewed_by as string | undefined,
    reviewedAt: row.reviewed_at as string | undefined,
    attended: row.attended as boolean | undefined,
    serviceHours: row.service_hours as number | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
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
    return (data || []).map(row => transformActivity(row as Record<string, unknown>))
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
    return (data || []).map(row => transformActivity(row as Record<string, unknown>))
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
    return (data || []).map(row => transformActivity(row as Record<string, unknown>))
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
    return transformActivity(data as Record<string, unknown>)
  },

  async createActivity(activityData: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Activity> {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id

    const { data: newActivity, error } = await supabase
      .from('activities')
      .insert({
        project_id: activityData.projectId,
        name: activityData.name,
        description: activityData.description,
        date: activityData.date,
        location: activityData.location,
        location_url: activityData.locationUrl,
        type: activityData.type,
        cover_image: activityData.coverImage,
        content_images: activityData.contentImages,
        capacity: activityData.capacity,
        registration_mode: activityData.registrationMode,
        status: activityData.status,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating activity:', error)
      throw error
    }
    return transformActivity(newActivity as Record<string, unknown>)
  },

  async updateActivity(id: string, activityData: Partial<Activity>): Promise<Activity | null> {
    const updateData: Record<string, unknown> = {}
    if (activityData.name !== undefined) updateData.name = activityData.name
    if (activityData.description !== undefined) updateData.description = activityData.description
    if (activityData.date !== undefined) updateData.date = activityData.date
    if (activityData.location !== undefined) updateData.location = activityData.location
    if (activityData.locationUrl !== undefined) updateData.location_url = activityData.locationUrl
    if (activityData.type !== undefined) updateData.type = activityData.type
    if (activityData.coverImage !== undefined) updateData.cover_image = activityData.coverImage
    if (activityData.contentImages !== undefined) updateData.content_images = activityData.contentImages
    if (activityData.capacity !== undefined) updateData.capacity = activityData.capacity
    if (activityData.registrationMode !== undefined) updateData.registration_mode = activityData.registrationMode
    if (activityData.status !== undefined) updateData.status = activityData.status

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
    return transformActivity(updated as Record<string, unknown>)
  },

  async archiveActivity(id: string): Promise<Activity | null> {
    return this.updateActivity(id, { status: 'archived' })
  },

  async deleteActivity(id: string): Promise<boolean> {
    // First delete related registrations
    await supabase
      .from('activity_registrations')
      .delete()
      .eq('activity_id', id)

    // Then delete the activity
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting activity:', error)
      return false
    }
    return true
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
    return (data || []).map(row => transformRegistration(row as Record<string, unknown>))
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
    return (data || []).map(row => transformRegistration(row as Record<string, unknown>))
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
    return transformRegistration(data as Record<string, unknown>)
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
    return transformRegistration(newReg as Record<string, unknown>)
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
    return transformRegistration(data as Record<string, unknown>)
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
    return transformRegistration(data as Record<string, unknown>)
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
    return (data || []).reduce((sum, r) => sum + ((r.service_hours as number) || 0), 0)
  },
}
