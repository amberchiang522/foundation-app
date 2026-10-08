import { supabase } from '@/lib/supabase'
import type { SystemSettings, AdminTag } from '@/types'

export const supabaseSettingsService = {
  // System Settings
  async getSettings(): Promise<SystemSettings> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .single()

    if (error) {
      console.error('Error fetching settings:', error)
      // Return default if not found
      return { youthAgeThreshold: 30 }
    }

    return {
      youthAgeThreshold: data.youth_age_threshold as number,
    }
  },

  async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const updateData: Record<string, unknown> = {}
    if (data.youthAgeThreshold !== undefined) {
      updateData.youth_age_threshold = data.youthAgeThreshold
    }

    const { data: updated, error } = await supabase
      .from('system_settings')
      .update(updateData)
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      throw error
    }

    return {
      youthAgeThreshold: updated.youth_age_threshold as number,
    }
  },

  // Admin Tags
  async getAdminTags(): Promise<AdminTag[]> {
    const { data, error } = await supabase
      .from('admin_tags')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching admin tags:', error)
      return []
    }

    return (data || []).map(tag => ({
      id: tag.id as string,
      name: tag.name as string,
      description: (tag.description as string) || '',
      createdAt: tag.created_at as string,
    }))
  },

  async createAdminTag(data: Omit<AdminTag, 'id' | 'createdAt'>): Promise<AdminTag> {
    const { data: newTag, error } = await supabase
      .from('admin_tags')
      .insert({
        name: data.name,
        description: data.description,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating admin tag:', error)
      throw error
    }

    return {
      id: newTag.id as string,
      name: newTag.name as string,
      description: (newTag.description as string) || '',
      createdAt: newTag.created_at as string,
    }
  },

  async updateAdminTag(id: string, data: Partial<AdminTag>): Promise<AdminTag | null> {
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description

    const { data: updated, error } = await supabase
      .from('admin_tags')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating admin tag:', error)
      return null
    }

    return {
      id: updated.id as string,
      name: updated.name as string,
      description: (updated.description as string) || '',
      createdAt: updated.created_at as string,
    }
  },

  async deleteAdminTag(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('admin_tags')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting admin tag:', error)
      return false
    }

    return true
  },
}
