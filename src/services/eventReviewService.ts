import type { EventReview, EventReviewWithDetails } from '@/types'
import { useSupabase, supabase } from '@/lib/supabase'

// Mock data
let mockReviews: EventReview[] = []

const mockEventReviewService = {
  async getPublishedReviews(): Promise<EventReviewWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockReviews.filter(r => r.isPublished)
  },

  async getReviewsByPlan(planId: string): Promise<EventReviewWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockReviews.filter(r => r.planId === planId && r.isPublished)
  },

  async getAllReviews(): Promise<EventReviewWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockReviews
  },

  async getReviewById(id: string): Promise<EventReviewWithDetails | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockReviews.find(r => r.id === id) || null
  },

  async createReview(data: Omit<EventReview, 'id' | 'createdAt' | 'updatedAt'>): Promise<EventReview> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newReview: EventReview = {
      ...data,
      id: `review-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockReviews.push(newReview)
    return newReview
  },

  async updateReview(id: string, data: Partial<EventReview>): Promise<EventReview | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockReviews.findIndex(r => r.id === id)
    if (index === -1) return null

    mockReviews[index] = {
      ...mockReviews[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return mockReviews[index]
  },

  async deleteReview(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200))
    const index = mockReviews.findIndex(r => r.id === id)
    if (index === -1) return false
    mockReviews.splice(index, 1)
    return true
  },

  async publishReview(id: string): Promise<EventReview | null> {
    return this.updateReview(id, {
      isPublished: true,
      publishedAt: new Date().toISOString()
    })
  },

  async unpublishReview(id: string): Promise<EventReview | null> {
    return this.updateReview(id, {
      isPublished: false,
      publishedAt: undefined
    })
  },
}

// Supabase implementation
function transformEventReview(row: Record<string, unknown>): EventReviewWithDetails {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    title: row.title as string,
    content: (row.content as string) || '',
    eventDate: row.event_date as string | undefined,
    images: (row.images as EventReview['images']) || [],
    isPublished: row.is_published as boolean,
    publishedAt: row.published_at as string | undefined,
    displayOrder: (row.display_order as number) || 0,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    plan: row.plan as EventReviewWithDetails['plan'],
    author: row.author as EventReviewWithDetails['author'],
  }
}

const supabaseEventReviewService = {
  async getPublishedReviews(): Promise<EventReviewWithDetails[]> {
    const { data, error } = await supabase
      .from('event_reviews')
      .select(`
        *,
        plan:plans(id, name)
      `)
      .eq('is_published', true)
      .order('published_at', { ascending: false })

    if (error) {
      console.error('Error fetching published reviews:', error)
      return []
    }
    return data.map(transformEventReview)
  },

  async getReviewsByPlan(planId: string): Promise<EventReviewWithDetails[]> {
    const { data, error } = await supabase
      .from('event_reviews')
      .select(`
        *,
        plan:plans(id, name)
      `)
      .eq('plan_id', planId)
      .eq('is_published', true)
      .order('event_date', { ascending: false })

    if (error) {
      console.error('Error fetching reviews by plan:', error)
      return []
    }
    return data.map(transformEventReview)
  },

  async getAllReviews(): Promise<EventReviewWithDetails[]> {
    const { data, error } = await supabase
      .from('event_reviews')
      .select(`
        *,
        plan:plans(id, name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching all reviews:', error)
      return []
    }
    return data.map(transformEventReview)
  },

  async getReviewById(id: string): Promise<EventReviewWithDetails | null> {
    const { data, error } = await supabase
      .from('event_reviews')
      .select(`
        *,
        plan:plans(id, name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching review:', error)
      return null
    }
    return transformEventReview(data)
  },

  async createReview(review: Omit<EventReview, 'id' | 'createdAt' | 'updatedAt'>): Promise<EventReview> {
    const { data: session } = await supabase.auth.getSession()

    const { data, error } = await supabase
      .from('event_reviews')
      .insert({
        plan_id: review.planId || null,  // Handle empty string
        title: review.title,
        content: review.content,
        event_date: review.eventDate,
        images: review.images,
        is_published: review.isPublished,
        published_at: review.isPublished ? new Date().toISOString() : null,
        display_order: review.displayOrder,
        created_by: session.session?.user.id,
      })
      .select()
      .single()

    if (error) throw error
    return transformEventReview(data)
  },

  async updateReview(id: string, updates: Partial<EventReview>): Promise<EventReview | null> {
    const updateData: Record<string, unknown> = {}

    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.eventDate !== undefined) updateData.event_date = updates.eventDate
    if (updates.images !== undefined) updateData.images = updates.images
    if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder
    if (updates.isPublished !== undefined) {
      updateData.is_published = updates.isPublished
      if (updates.isPublished) {
        updateData.published_at = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('event_reviews')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating review:', error)
      return null
    }
    return transformEventReview(data)
  },

  async deleteReview(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('event_reviews')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting review:', error)
      return false
    }
    return true
  },

  async publishReview(id: string): Promise<EventReview | null> {
    return this.updateReview(id, {
      isPublished: true,
      publishedAt: new Date().toISOString()
    })
  },

  async unpublishReview(id: string): Promise<EventReview | null> {
    return this.updateReview(id, {
      isPublished: false,
      publishedAt: undefined
    })
  },
}

export const eventReviewService = useSupabase
  ? supabaseEventReviewService
  : mockEventReviewService
