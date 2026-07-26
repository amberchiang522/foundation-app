import type { SystemSettings, AdminTag } from '@/types'
import { mockSystemSettings, mockAdminTags } from '@/data/mockData'

// In-memory store
let settings = { ...mockSystemSettings }
let adminTags = [...mockAdminTags]

export const settingsService = {
  // System Settings
  async getSettings(): Promise<SystemSettings> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return settings
  },

  async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    await new Promise(resolve => setTimeout(resolve, 300))
    settings = { ...settings, ...data }
    return settings
  },

  // Admin Tags
  async getAdminTags(): Promise<AdminTag[]> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return adminTags
  },

  async createAdminTag(data: Omit<AdminTag, 'id' | 'createdAt'>): Promise<AdminTag> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const newTag: AdminTag = {
      ...data,
      id: `tag-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }

    adminTags.push(newTag)
    return newTag
  },

  async updateAdminTag(id: string, data: Partial<AdminTag>): Promise<AdminTag | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = adminTags.findIndex(t => t.id === id)
    if (index === -1) return null

    adminTags[index] = {
      ...adminTags[index],
      ...data,
    }
    return adminTags[index]
  },

  async deleteAdminTag(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = adminTags.findIndex(t => t.id === id)
    if (index === -1) return false

    adminTags.splice(index, 1)
    return true
  },
}
