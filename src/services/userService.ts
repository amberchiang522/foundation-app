import type { User, VolunteerApplication } from '@/types'
import { mockUsers, mockApplications, mockSystemSettings } from '@/data/mockData'
import { useSupabase } from '@/lib/supabase'
import { supabaseUserService } from './supabase/userService'

// In-memory store for mock data (simulating database)
let users = [...mockUsers]
let applications = [...mockApplications]
let youthCounter = users.filter(u => u.type === 'youth').length
let socialCounter = users.filter(u => u.type === 'social').length

function generateVolunteerNumber(type: 'youth' | 'social'): string {
  if (type === 'youth') {
    youthCounter++
    return `Y-${String(youthCounter).padStart(3, '0')}`
  } else {
    socialCounter++
    return `S-${String(socialCounter).padStart(3, '0')}`
  }
}

function determineVolunteerType(birthday: string): 'youth' | 'social' {
  const birthDate = new Date(birthday)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  return age < mockSystemSettings.youthAgeThreshold ? 'youth' : 'social'
}

const mockUserService = {
  // Users
  async getUsers(): Promise<User[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return users.filter(u => u.role === 'volunteer')
  },

  // Get admin staff (admins, super_admins) for assignment
  async getAllStaff(): Promise<User[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return users.filter(u => u.status === 'active' && (u.role === 'admin' || u.role === 'super_admin'))
  },

  async getUserById(id: string): Promise<User | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return users.find(u => u.id === id) || null
  },

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = users.findIndex(u => u.id === id)
    if (index === -1) return null

    users[index] = {
      ...users[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return users[index]
  },

  async suspendUser(id: string): Promise<User | null> {
    return this.updateUser(id, { status: 'suspended' })
  },

  async activateUser(id: string): Promise<User | null> {
    return this.updateUser(id, { status: 'active' })
  },

  // Applications
  async getApplications(): Promise<VolunteerApplication[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return applications
  },

  async getApplicationById(id: string): Promise<VolunteerApplication | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return applications.find(a => a.id === id) || null
  },

  async getApplicationByToken(token: string): Promise<VolunteerApplication | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return applications.find(a => a.token === token) || null
  },

  async getApplicationByEmail(email: string): Promise<VolunteerApplication | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return applications.find(a => a.email === email) || null
  },

  async createApplication(data: Omit<VolunteerApplication, 'id' | 'token' | 'status' | 'createdAt' | 'updatedAt'>): Promise<VolunteerApplication> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const newApplication: VolunteerApplication = {
      ...data,
      id: `app-${Date.now()}`,
      token: `token-${Math.random().toString(36).substring(7)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    applications.push(newApplication)
    return newApplication
  },

  async updateApplication(id: string, data: Partial<VolunteerApplication>): Promise<VolunteerApplication | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = applications.findIndex(a => a.id === id)
    if (index === -1) return null

    applications[index] = {
      ...applications[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return applications[index]
  },

  async approveApplication(id: string, reviewerId: string): Promise<User | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const application = await this.getApplicationById(id)
    if (!application) return null

    // Update application status
    await this.updateApplication(id, {
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    })

    // Create new user
    const volunteerType = determineVolunteerType(application.birthday)
    const newUser: User = {
      id: `user-${Date.now()}`,
      volunteerNumber: generateVolunteerNumber(volunteerType),
      type: volunteerType,
      role: 'volunteer',
      name: application.name,
      email: application.email,
      phone: application.phone,
      birthday: application.birthday,
      occupation: application.occupation,
      experience: application.experience,
      lineId: application.lineId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    users.push(newUser)

    // Mock email notification
    console.log(`[Mock Email] 發送審核通過通知至 ${application.email}`)
    console.log(`帳號: ${application.email}, 預設密碼: ${application.phone}`)

    return newUser
  },

  async rejectApplication(id: string, reviewerId: string, reason: string): Promise<VolunteerApplication | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const result = await this.updateApplication(id, {
      status: 'rejected',
      reviewNote: reason,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    })

    if (result) {
      console.log(`[Mock Email] 發送審核拒絕通知至 ${result.email}`)
      console.log(`理由: ${reason}`)
    }

    return result
  },

  async requestRevision(id: string, reviewerId: string, note: string): Promise<VolunteerApplication | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const result = await this.updateApplication(id, {
      status: 'needs_revision',
      reviewNote: note,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    })

    if (result) {
      console.log(`[Mock Email] 發送補件通知至 ${result.email}`)
      console.log(`補件說明: ${note}`)
      console.log(`補件連結: /apply/edit/${result.token}`)
    }

    return result
  },

  // Stats
  async getStats(): Promise<{ totalVolunteers: number; youthCount: number; socialCount: number; pendingApplications: number }> {
    await new Promise(resolve => setTimeout(resolve, 200))

    const volunteers = users.filter(u => u.role === 'volunteer')
    return {
      totalVolunteers: volunteers.length,
      youthCount: volunteers.filter(u => u.type === 'youth').length,
      socialCount: volunteers.filter(u => u.type === 'social').length,
      pendingApplications: applications.filter(a => a.status === 'pending').length,
    }
  },
}

// Export the appropriate service based on feature flag
export const userService = useSupabase ? supabaseUserService : mockUserService
