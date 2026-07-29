import type { Activity, ActivityRegistration } from '@/types'
import { mockActivities, mockRegistrations } from '@/data/mockData'
import { useSupabase } from '@/lib/supabase'
import { supabaseActivityService } from './supabase/activityService'

// In-memory store
let activities = [...mockActivities]
let registrations = [...mockRegistrations]

const mockActivityService = {
  // Activities
  async getActivities(): Promise<Activity[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return activities
  },

  async getUpcomingActivities(): Promise<Activity[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return activities.filter(a => a.status === 'upcoming' || a.status === 'ongoing')
  },

  async getPastActivities(): Promise<Activity[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return activities.filter(a => a.status === 'completed' || a.status === 'archived')
  },

  async getActivityById(id: string): Promise<Activity | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return activities.find(a => a.id === id) || null
  },

  async createActivity(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Activity> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const newActivity: Activity = {
      ...data,
      id: `activity-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    activities.push(newActivity)
    return newActivity
  },

  async updateActivity(id: string, data: Partial<Activity>): Promise<Activity | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = activities.findIndex(a => a.id === id)
    if (index === -1) return null

    activities[index] = {
      ...activities[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return activities[index]
  },

  async archiveActivity(id: string): Promise<Activity | null> {
    return this.updateActivity(id, { status: 'archived' })
  },

  async deleteActivity(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200))
    const index = activities.findIndex(a => a.id === id)
    if (index === -1) return false

    // Remove related registrations
    const activityId = activities[index].id
    const regIndexes = registrations
      .map((r, i) => r.activityId === activityId ? i : -1)
      .filter(i => i !== -1)
      .reverse()
    regIndexes.forEach(i => registrations.splice(i, 1))

    // Remove activity
    activities.splice(index, 1)
    return true
  },

  // Registrations
  async getRegistrationsByActivity(activityId: string): Promise<ActivityRegistration[]> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return registrations.filter(r => r.activityId === activityId)
  },

  async getRegistrationsByUser(userId: string): Promise<ActivityRegistration[]> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return registrations.filter(r => r.userId === userId)
  },

  async getRegistration(activityId: string, userId: string): Promise<ActivityRegistration | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return registrations.find(r => r.activityId === activityId && r.userId === userId) || null
  },

  async registerForActivity(activityId: string, userId: string): Promise<ActivityRegistration | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const activity = await this.getActivityById(activityId)
    if (!activity) return null

    // Check if already registered
    const existing = await this.getRegistration(activityId, userId)
    if (existing) return existing

    // Count confirmed registrations
    const confirmed = registrations.filter(
      r => r.activityId === activityId && r.status === 'confirmed'
    ).length

    // Determine status based on capacity and mode
    let status: ActivityRegistration['status'] = 'confirmed'

    if (confirmed >= activity.capacity) {
      status = 'waitlist'
    } else if (activity.registrationMode === 'approval') {
      status = 'pending'
    }

    // Calculate waitlist position if needed
    let waitlistPosition: number | undefined
    if (status === 'waitlist') {
      const waitlistCount = registrations.filter(
        r => r.activityId === activityId && r.status === 'waitlist'
      ).length
      waitlistPosition = waitlistCount + 1
    }

    const newRegistration: ActivityRegistration = {
      id: `reg-${Date.now()}`,
      activityId,
      userId,
      status,
      waitlistPosition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    registrations.push(newRegistration)
    return newRegistration
  },

  async cancelRegistration(activityId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const index = registrations.findIndex(
      r => r.activityId === activityId && r.userId === userId
    )
    if (index === -1) return false

    registrations[index] = {
      ...registrations[index],
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    }

    // Promote first waitlist person
    const waitlist = registrations
      .filter(r => r.activityId === activityId && r.status === 'waitlist')
      .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0))

    if (waitlist.length > 0) {
      const firstInLine = waitlist[0]
      const firstIndex = registrations.findIndex(r => r.id === firstInLine.id)
      registrations[firstIndex] = {
        ...registrations[firstIndex],
        status: 'confirmed',
        waitlistPosition: undefined,
        updatedAt: new Date().toISOString(),
      }

      console.log(`[Mock Email] 通知候補者 ${firstInLine.userId} 已遞補成功`)

      // Update remaining waitlist positions
      waitlist.slice(1).forEach((w, i) => {
        const wIndex = registrations.findIndex(r => r.id === w.id)
        registrations[wIndex] = {
          ...registrations[wIndex],
          waitlistPosition: i + 1,
          updatedAt: new Date().toISOString(),
        }
      })
    }

    return true
  },

  async approveRegistration(registrationId: string, reviewerId: string): Promise<ActivityRegistration | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const index = registrations.findIndex(r => r.id === registrationId)
    if (index === -1) return null

    registrations[index] = {
      ...registrations[index],
      status: 'confirmed',
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return registrations[index]
  },

  async recordAttendance(registrationId: string, attended: boolean, serviceHours?: number): Promise<ActivityRegistration | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const index = registrations.findIndex(r => r.id === registrationId)
    if (index === -1) return null

    registrations[index] = {
      ...registrations[index],
      attended,
      serviceHours,
      updatedAt: new Date().toISOString(),
    }

    return registrations[index]
  },

  // Stats
  async getStats(): Promise<{ totalActivities: number; upcomingCount: number; completedCount: number }> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      totalActivities: activities.length,
      upcomingCount: activities.filter(a => a.status === 'upcoming' || a.status === 'ongoing').length,
      completedCount: activities.filter(a => a.status === 'completed').length,
    }
  },

  async getUserServiceHours(userId: string): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return registrations
      .filter(r => r.userId === userId && r.attended && r.serviceHours)
      .reduce((sum, r) => sum + (r.serviceHours || 0), 0)
  },
}

// Export the appropriate service based on feature flag
export const activityService = useSupabase ? supabaseActivityService : mockActivityService
