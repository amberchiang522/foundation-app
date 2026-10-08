import { supabase } from '@/lib/supabase'

export interface EvaluationCriteria {
  id: string
  templateId: string
  name: string
  description: string | null
  subDescription: string | null
  maxScore: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface EvaluationTemplate {
  id: string
  name: string
  description: string | null
  version: number
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  criteria?: EvaluationCriteria[]
}

function transformTemplate(row: Record<string, unknown>): EvaluationTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    version: row.version as number,
    isActive: row.is_active as boolean,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function transformCriteria(row: Record<string, unknown>): EvaluationCriteria {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    name: row.name as string,
    description: row.description as string | null,
    subDescription: row.sub_description as string | null,
    maxScore: row.max_score as number,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export const supabaseEvaluationService = {
  // 取得所有評估範本
  async getTemplates(): Promise<EvaluationTemplate[]> {
    const { data, error } = await supabase
      .from('evaluation_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching evaluation templates:', error)
      return []
    }
    return (data || []).map(row => transformTemplate(row as Record<string, unknown>))
  },

  // 取得啟用中的評估範本
  async getActiveTemplate(): Promise<EvaluationTemplate | null> {
    const { data, error } = await supabase
      .from('evaluation_templates')
      .select('*')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching active template:', error)
      return null
    }
    return transformTemplate(data as Record<string, unknown>)
  },

  // 取得範本的評估項目
  async getCriteria(templateId: string): Promise<EvaluationCriteria[]> {
    const { data, error } = await supabase
      .from('evaluation_criteria')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching criteria:', error)
      return []
    }
    return (data || []).map(row => transformCriteria(row as Record<string, unknown>))
  },

  // 取得啟用中的評估項目
  async getActiveCriteria(): Promise<EvaluationCriteria[]> {
    const template = await this.getActiveTemplate()
    if (!template) return []
    return this.getCriteria(template.id)
  },

  // 建立新範本
  async createTemplate(data: { name: string; description?: string }): Promise<EvaluationTemplate | null> {
    const { data: result, error } = await supabase
      .from('evaluation_templates')
      .insert({
        name: data.name,
        description: data.description || null,
        version: 1,
        is_active: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return null
    }
    return transformTemplate(result as Record<string, unknown>)
  },

  // 更新範本
  async updateTemplate(id: string, data: Partial<{ name: string; description: string; isActive: boolean }>): Promise<boolean> {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive
      // 如果啟用此範本，停用其他範本
      if (data.isActive) {
        await supabase.from('evaluation_templates').update({ is_active: false }).neq('id', id)
      }
    }

    const { error } = await supabase
      .from('evaluation_templates')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating template:', error)
      return false
    }
    return true
  },

  // 刪除範本
  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('evaluation_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting template:', error)
      return false
    }
    return true
  },

  // 新增評估項目
  async createCriteria(data: {
    templateId: string
    name: string
    description?: string
    subDescription?: string
    maxScore: number
    sortOrder: number
  }): Promise<EvaluationCriteria | null> {
    const { data: result, error } = await supabase
      .from('evaluation_criteria')
      .insert({
        template_id: data.templateId,
        name: data.name,
        description: data.description || null,
        sub_description: data.subDescription || null,
        max_score: data.maxScore,
        sort_order: data.sortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating criteria:', error)
      return null
    }
    return transformCriteria(result as Record<string, unknown>)
  },

  // 更新評估項目
  async updateCriteria(id: string, data: Partial<{
    name: string
    description: string
    subDescription: string
    maxScore: number
    sortOrder: number
  }>): Promise<boolean> {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.subDescription !== undefined) updateData.sub_description = data.subDescription
    if (data.maxScore !== undefined) updateData.max_score = data.maxScore
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

    const { error } = await supabase
      .from('evaluation_criteria')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating criteria:', error)
      return false
    }
    return true
  },

  // 刪除評估項目
  async deleteCriteria(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('evaluation_criteria')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting criteria:', error)
      return false
    }
    return true
  },

  // 複製範本（建立新版本）
  async duplicateTemplate(templateId: string, newName: string): Promise<EvaluationTemplate | null> {
    // 取得原範本
    const { data: original, error: fetchError } = await supabase
      .from('evaluation_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (fetchError || !original) {
      console.error('Error fetching original template:', fetchError)
      return null
    }

    // 取得最高版本號
    const { data: maxVersion } = await supabase
      .from('evaluation_templates')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = (maxVersion?.version || 0) + 1

    // 建立新範本
    const { data: newTemplate, error: createError } = await supabase
      .from('evaluation_templates')
      .insert({
        name: newName,
        description: original.description,
        version: newVersion,
        is_active: false,
      })
      .select()
      .single()

    if (createError || !newTemplate) {
      console.error('Error creating new template:', createError)
      return null
    }

    // 複製評估項目
    const criteria = await this.getCriteria(templateId)
    for (const c of criteria) {
      await this.createCriteria({
        templateId: newTemplate.id,
        name: c.name,
        description: c.description || undefined,
        subDescription: c.subDescription || undefined,
        maxScore: c.maxScore,
        sortOrder: c.sortOrder,
      })
    }

    return transformTemplate(newTemplate as Record<string, unknown>)
  },
}
