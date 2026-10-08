// R2 Storage Client - communicates with Cloudflare Worker

import { supabase } from '@/lib/supabase'

const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || ''

// Get current user's access token for authentication
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export type R2BucketName = 'avatars' | 'activities' | 'projects' | 'plans' | 'attachments'

// Private buckets that require authentication for download
const PRIVATE_BUCKETS: R2BucketName[] = ['attachments', 'projects']

export function isPrivateBucket(bucket: R2BucketName): boolean {
  return PRIVATE_BUCKETS.includes(bucket)
}

export interface R2UploadResult {
  success: boolean
  url: string
  bucket: R2BucketName
  path: string
  size: number
  contentType: string
}

export interface R2ListResult {
  files: Array<{
    key: string
    size: number
    uploaded: string
    url: string
  }>
  truncated: boolean
  cursor: string | null
}

class R2Client {
  private workerUrl: string

  constructor() {
    this.workerUrl = R2_WORKER_URL
  }

  /**
   * Upload a file directly to R2 via the Worker
   */
  async upload(
    file: File | Blob,
    bucket: R2BucketName,
    path: string,
    contentType?: string
  ): Promise<R2UploadResult> {
    if (!this.workerUrl) {
      throw new Error('R2 Worker URL not configured. Set VITE_R2_WORKER_URL in environment.')
    }

    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated. Please login to upload files.')
    }

    const response = await fetch(`${this.workerUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Bucket': bucket,
        'X-Path': path,
        'X-Content-Type': contentType || file.type || 'application/octet-stream',
      },
      body: file,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || `Upload failed with status ${response.status}`)
    }

    return response.json()
  }

  /**
   * Delete a file from R2
   */
  async delete(bucket: R2BucketName, path: string): Promise<void> {
    if (!this.workerUrl) {
      throw new Error('R2 Worker URL not configured')
    }

    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated. Please login to delete files.')
    }

    const response = await fetch(`${this.workerUrl}/delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucket, path }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Delete failed' }))
      console.error('R2 delete error:', error)
      // Don't throw - file might already be deleted
    }
  }

  /**
   * List files in a bucket (admin only, for migration purposes)
   */
  async list(bucket: R2BucketName, prefix?: string, cursor?: string): Promise<R2ListResult> {
    if (!this.workerUrl) {
      throw new Error('R2 Worker URL not configured')
    }

    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated. Please login to list files.')
    }

    const params = new URLSearchParams({ bucket })
    if (prefix) params.append('prefix', prefix)
    if (cursor) params.append('cursor', cursor)

    const response = await fetch(`${this.workerUrl}/list?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'List failed' }))
      throw new Error(error.error || `List failed with status ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get URL for a file (served via Worker)
   * Note: For private buckets, use fetchPrivateFile() instead
   */
  getPublicUrl(bucket: R2BucketName, path: string): string {
    if (!this.workerUrl) {
      console.warn('R2 Worker URL not configured. Set VITE_R2_WORKER_URL in environment.')
      return ''
    }
    // Use Worker to serve files for reliable access
    return `${this.workerUrl}/file/${bucket}/${path}`
  }

  /**
   * Fetch a private file with authentication and return a blob URL
   * Use this for private buckets (attachments, projects)
   */
  async fetchPrivateFile(bucket: R2BucketName, path: string): Promise<string> {
    if (!this.workerUrl) {
      throw new Error('R2 Worker URL not configured')
    }

    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated. Please login to access files.')
    }

    const response = await fetch(`${this.workerUrl}/file/${bucket}/${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  /**
   * Get file URL - automatically handles public vs private buckets
   * For private buckets, returns a Promise that resolves to a blob URL
   * For public buckets, returns a Promise that resolves to the direct URL
   */
  async getFileUrl(bucket: R2BucketName, path: string): Promise<string> {
    if (isPrivateBucket(bucket)) {
      return this.fetchPrivateFile(bucket, path)
    }
    return this.getPublicUrl(bucket, path)
  }

  /**
   * Generate a unique file path
   */
  generatePath(folder: string, fileName: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const ext = fileName.split('.').pop() || 'bin'
    return `${folder}/${timestamp}_${random}.${ext}`
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.workerUrl) return false

    try {
      const response = await fetch(`${this.workerUrl}/health`)
      return response.ok
    } catch {
      return false
    }
  }
}

export const r2Client = new R2Client()
