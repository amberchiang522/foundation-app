import type { PlanPublicInfo, ImageData, PDFData } from '@/types'
import { useSupabase, supabase } from '@/lib/supabase'

// Transform database row to PlanPublicInfo
function transformPlanPublicInfo(row: Record<string, unknown>): PlanPublicInfo {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    name: row.name as string,
    cardDescription: row.card_description as string | undefined,
    publicDescription: row.public_description as string | undefined,
    coverImage: row.cover_image as ImageData | undefined,
    introPdf: row.intro_pdf as PDFData | undefined,
    downloadPdfs: (row.download_pdfs as PDFData[]) || [],
    displayOrder: (row.display_order as number) || 0,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// Mock data for development
let mockPublicPlans: PlanPublicInfo[] = []

const mockPlanPublicService = {
  // 取得所有公開計畫（首頁用）
  async getPublicPlans(): Promise<PlanPublicInfo[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockPublicPlans
      .filter(p => p.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  },

  // 取得單一公開計畫
  async getPublicPlanById(id: string): Promise<PlanPublicInfo | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockPublicPlans.find(p => p.id === id && p.isActive) || null
  },

  // 取得單一公開計畫（依 planId）
  async getPublicPlanByPlanId(planId: string): Promise<PlanPublicInfo | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockPublicPlans.find(p => p.planId === planId && p.isActive) || null
  },

  // Admin: 取得所有公開計畫資訊（包含未啟用）
  async getAllPublicPlanInfo(): Promise<PlanPublicInfo[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return [...mockPublicPlans].sort((a, b) => a.displayOrder - b.displayOrder)
  },

  // Admin: 建立或更新公開計畫資訊
  async upsertPublicPlanInfo(planId: string, data: Partial<PlanPublicInfo>): Promise<PlanPublicInfo> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const existing = mockPublicPlans.find(p => p.planId === planId)

    if (existing) {
      Object.assign(existing, data, { updatedAt: new Date().toISOString() })
      return existing
    } else {
      const newInfo: PlanPublicInfo = {
        id: `public-${Date.now()}`,
        planId,
        name: data.name || '',
        cardDescription: data.cardDescription,
        publicDescription: data.publicDescription,
        coverImage: data.coverImage,
        introPdf: data.introPdf,
        downloadPdfs: data.downloadPdfs || [],
        displayOrder: data.displayOrder || 0,
        isActive: data.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockPublicPlans.push(newInfo)
      return newInfo
    }
  },

  // Admin: 刪除公開計畫資訊
  async deletePublicPlanInfo(planId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200))
    const index = mockPublicPlans.findIndex(p => p.planId === planId)
    if (index === -1) return false
    mockPublicPlans.splice(index, 1)
    return true
  },

  // Admin: 更新顯示順序
  async updateDisplayOrder(items: { id: string; displayOrder: number }[]): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))
    items.forEach(item => {
      const plan = mockPublicPlans.find(p => p.id === item.id)
      if (plan) {
        plan.displayOrder = item.displayOrder
      }
    })
    return true
  },
}

// Supabase implementation
const supabasePlanPublicService = {
  // 取得所有公開計畫（首頁用）
  async getPublicPlans(): Promise<PlanPublicInfo[]> {
    const { data, error } = await supabase
      .from('plan_public_info')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching public plans:', error)
      return []
    }
    return data.map(transformPlanPublicInfo)
  },

  // 取得單一公開計畫
  async getPublicPlanById(id: string): Promise<PlanPublicInfo | null> {
    const { data, error } = await supabase
      .from('plan_public_info')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error fetching public plan:', error)
      return null
    }
    return transformPlanPublicInfo(data)
  },

  // 取得單一公開計畫（依 planId）
  async getPublicPlanByPlanId(planId: string): Promise<PlanPublicInfo | null> {
    const { data, error } = await supabase
      .from('plan_public_info')
      .select('*')
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code !== 'PGRST116') { // Not found is ok
        console.error('Error fetching public plan:', error)
      }
      return null
    }
    return transformPlanPublicInfo(data)
  },

  // Admin: 取得所有公開計畫資訊（包含未啟用）
  async getAllPublicPlanInfo(): Promise<PlanPublicInfo[]> {
    const { data, error } = await supabase
      .from('plan_public_info')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching all public plan info:', error)
      return []
    }
    return data.map(transformPlanPublicInfo)
  },

  // Admin: 建立或更新公開計畫資訊
  async upsertPublicPlanInfo(planId: string, data: Partial<PlanPublicInfo>): Promise<PlanPublicInfo> {
    const upsertData: Record<string, unknown> = {
      plan_id: planId,
    }

    if (data.name !== undefined) upsertData.name = data.name
    if (data.cardDescription !== undefined) upsertData.card_description = data.cardDescription
    if (data.publicDescription !== undefined) upsertData.public_description = data.publicDescription
    if (data.coverImage !== undefined) upsertData.cover_image = data.coverImage
    if (data.introPdf !== undefined) upsertData.intro_pdf = data.introPdf
    if (data.downloadPdfs !== undefined) upsertData.download_pdfs = data.downloadPdfs
    if (data.displayOrder !== undefined) upsertData.display_order = data.displayOrder
    if (data.isActive !== undefined) upsertData.is_active = data.isActive

    const { data: result, error } = await supabase
      .from('plan_public_info')
      .upsert(upsertData, { onConflict: 'plan_id' })
      .select()
      .single()

    if (error) throw error
    return transformPlanPublicInfo(result)
  },

  // Admin: 刪除公開計畫資訊
  async deletePublicPlanInfo(planId: string): Promise<boolean> {
    const { error } = await supabase
      .from('plan_public_info')
      .delete()
      .eq('plan_id', planId)

    if (error) {
      console.error('Error deleting public plan info:', error)
      return false
    }
    return true
  },

  // Admin: 更新顯示順序
  async updateDisplayOrder(items: { id: string; displayOrder: number }[]): Promise<boolean> {
    const updates = items.map(item =>
      supabase
        .from('plan_public_info')
        .update({ display_order: item.displayOrder })
        .eq('id', item.id)
    )

    const results = await Promise.all(updates)
    return results.every(r => !r.error)
  },
}

export const planPublicService = useSupabase
  ? supabasePlanPublicService
  : mockPlanPublicService
