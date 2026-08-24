import type { ForumPost, ForumPostWithDetails, ForumReply, ForumReplyWithDetails } from '@/types'
import { useSupabase, supabase } from '@/lib/supabase'

// Mock data
let mockPosts: ForumPost[] = []
let mockReplies: ForumReply[] = []

const mockForumService = {
  async getPosts(options?: { planId?: string; limit?: number; offset?: number }): Promise<ForumPostWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    let filtered = mockPosts.filter(p => p.status === 'active')
    if (options?.planId) {
      filtered = filtered.filter(p => p.planId === options.planId)
    }
    // Sort: pinned first, then by lastReplyAt
    filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      const aTime = a.lastReplyAt || a.createdAt
      const bTime = b.lastReplyAt || b.createdAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
    if (options?.offset) {
      filtered = filtered.slice(options.offset)
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit)
    }
    return filtered
  },

  async getPostById(id: string): Promise<ForumPostWithDetails | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    const post = mockPosts.find(p => p.id === id)
    if (post) {
      post.viewCount += 1
    }
    return post || null
  },

  async getReplies(postId: string): Promise<ForumReplyWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockReplies.filter(r => r.postId === postId && !r.isDeleted)
  },

  async createPost(data: Omit<ForumPost, 'id' | 'viewCount' | 'replyCount' | 'createdAt' | 'updatedAt'>): Promise<ForumPost> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newPost: ForumPost = {
      ...data,
      id: `post-${Date.now()}`,
      viewCount: 0,
      replyCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockPosts.push(newPost)
    return newPost
  },

  async updatePost(id: string, data: Partial<ForumPost>): Promise<ForumPost | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = mockPosts.findIndex(p => p.id === id)
    if (index === -1) return null

    mockPosts[index] = {
      ...mockPosts[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return mockPosts[index]
  },

  async deletePost(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200))
    const index = mockPosts.findIndex(p => p.id === id)
    if (index === -1) return false
    mockPosts.splice(index, 1)
    // Remove related replies
    mockReplies = mockReplies.filter(r => r.postId !== id)
    return true
  },

  async createReply(data: Omit<ForumReply, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'>): Promise<ForumReply> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newReply: ForumReply = {
      ...data,
      id: `reply-${Date.now()}`,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockReplies.push(newReply)
    // Update post stats
    const postIndex = mockPosts.findIndex(p => p.id === data.postId)
    if (postIndex !== -1) {
      mockPosts[postIndex].replyCount += 1
      mockPosts[postIndex].lastReplyAt = newReply.createdAt
      mockPosts[postIndex].lastReplyBy = data.createdBy
    }
    return newReply
  },

  async deleteReply(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200))
    const index = mockReplies.findIndex(r => r.id === id)
    if (index === -1) return false
    mockReplies[index].isDeleted = true
    return true
  },

  async pinPost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { isPinned: true })
  },

  async unpinPost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { isPinned: false })
  },

  async closePost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { status: 'closed' })
  },

  // Admin methods
  async getAllPosts(): Promise<ForumPostWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return [...mockPosts].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  },

  async getPendingPosts(): Promise<ForumPostWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockPosts
      .filter(p => p.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async approvePost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { status: 'active' })
  },

  async rejectPost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { status: 'archived' })
  },
}

// Supabase implementation
function transformAuthor(author: unknown): ForumPostWithDetails['author'] {
  if (!author || typeof author !== 'object') return undefined
  const a = author as Record<string, unknown>
  return {
    id: a.id as string,
    name: a.name as string,
    avatar: a.avatar as ForumPostWithDetails['author'] extends { avatar?: infer T } ? T : undefined,
    createdAt: (a.created_at || a.createdAt) as string | undefined,
  }
}

function transformForumPost(row: Record<string, unknown>): ForumPostWithDetails {
  return {
    id: row.id as string,
    planId: row.plan_id as string | undefined,
    title: row.title as string,
    content: row.content as string,
    images: (row.images as ForumPost['images']) || [],
    status: row.status as ForumPost['status'],
    isPinned: row.is_pinned as boolean,
    viewCount: (row.view_count as number) || 0,
    replyCount: (row.reply_count as number) || 0,
    lastReplyAt: row.last_reply_at as string | undefined,
    lastReplyBy: row.last_reply_by as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    plan: row.plan as ForumPostWithDetails['plan'],
    author: transformAuthor(row.author as Record<string, unknown> | null),
  }
}

function transformForumReply(row: Record<string, unknown>): ForumReplyWithDetails {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    parentId: row.parent_id as string | undefined,
    content: row.content as string,
    images: (row.images as ForumReply['images']) || [],
    isDeleted: row.is_deleted as boolean,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    author: row.author as ForumReplyWithDetails['author'],
  }
}

const supabaseForumService = {
  async getPosts(options?: { planId?: string; limit?: number; offset?: number }): Promise<ForumPostWithDetails[]> {
    let query = supabase
      .from('forum_posts')
      .select(`
        *,
        plan:plans(id, name),
        author:profiles!created_by(id, name, avatar, created_at)
      `)
      .eq('status', 'active')
      .order('is_pinned', { ascending: false })
      .order('last_reply_at', { ascending: false, nullsFirst: false })

    if (options?.planId) {
      query = query.eq('plan_id', options.planId)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching posts:', error)
      return []
    }
    return data.map(transformForumPost)
  },

  async getPostById(id: string): Promise<ForumPostWithDetails | null> {
    // Increment view count
    await supabase.rpc('increment_view_count', { post_id: id })

    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        *,
        plan:plans(id, name),
        author:profiles!created_by(id, name, avatar, created_at)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching post:', error)
      return null
    }
    return transformForumPost(data)
  },

  async getReplies(postId: string): Promise<ForumReplyWithDetails[]> {
    const { data, error } = await supabase
      .from('forum_replies')
      .select(`
        *,
        author:profiles!created_by(id, name, avatar, created_at)
      `)
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching replies:', error)
      return []
    }
    return data.map(transformForumReply)
  },

  async createPost(post: Omit<ForumPost, 'id' | 'viewCount' | 'replyCount' | 'createdAt' | 'updatedAt'>): Promise<ForumPost> {
    const { data: session } = await supabase.auth.getSession()

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        plan_id: post.planId || null,
        title: post.title,
        content: post.content,
        images: post.images,
        status: post.status || 'active',
        is_pinned: post.isPinned || false,
        created_by: session.session?.user.id,
      })
      .select()
      .single()

    if (error) throw error
    return transformForumPost(data)
  },

  async updatePost(id: string, updates: Partial<ForumPost>): Promise<ForumPost | null> {
    const updateData: Record<string, unknown> = {}

    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.images !== undefined) updateData.images = updates.images
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.isPinned !== undefined) updateData.is_pinned = updates.isPinned

    const { data, error } = await supabase
      .from('forum_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating post:', error)
      return null
    }
    return transformForumPost(data)
  },

  async deletePost(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting post:', error)
      return false
    }
    return true
  },

  async createReply(reply: Omit<ForumReply, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'>): Promise<ForumReply> {
    const { data: session } = await supabase.auth.getSession()

    const { data, error } = await supabase
      .from('forum_replies')
      .insert({
        post_id: reply.postId,
        parent_id: reply.parentId || null,
        content: reply.content,
        images: reply.images,
        created_by: session.session?.user.id,
      })
      .select()
      .single()

    if (error) throw error
    return transformForumReply(data)
  },

  async deleteReply(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('forum_replies')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) {
      console.error('Error deleting reply:', error)
      return false
    }
    return true
  },

  async pinPost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { isPinned: true })
  },

  async unpinPost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { isPinned: false })
  },

  async closePost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { status: 'closed' })
  },

  // Admin: Get all posts including pending
  async getAllPosts(): Promise<ForumPostWithDetails[]> {
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        *,
        plan:plans(id, name),
        author:profiles!created_by(id, name, avatar, created_at)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching all posts:', error)
      return []
    }
    return data.map(transformForumPost)
  },

  // Admin: Get pending posts only
  async getPendingPosts(): Promise<ForumPostWithDetails[]> {
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        *,
        plan:plans(id, name),
        author:profiles!created_by(id, name, avatar, created_at)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending posts:', error)
      return []
    }
    return data.map(transformForumPost)
  },

  // Admin: Approve a post
  async approvePost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { status: 'active' })
  },

  // Admin: Reject a post
  async rejectPost(id: string): Promise<ForumPost | null> {
    return this.updatePost(id, { status: 'archived' })
  },
}

export const forumService = useSupabase
  ? supabaseForumService
  : mockForumService
