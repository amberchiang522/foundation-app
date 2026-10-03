// R2 Storage Client - communicates with Cloudflare Worker

const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || ''

export type R2BucketName = 'avatars' | 'activities' | 'projects' | 'plans' | 'attachments'

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

    const response = await fetch(`${this.workerUrl}/upload`, {
      method: 'POST',
      headers: {
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

    const response = await fetch(`${this.workerUrl}/delete`, {
      method: 'POST',
      headers: {
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
   * List files in a bucket (for migration purposes)
   */
  async list(bucket: R2BucketName, prefix?: string, cursor?: string): Promise<R2ListResult> {
    if (!this.workerUrl) {
      throw new Error('R2 Worker URL not configured')
    }

    const params = new URLSearchParams({ bucket })
    if (prefix) params.append('prefix', prefix)
    if (cursor) params.append('cursor', cursor)

    const response = await fetch(`${this.workerUrl}/list?${params}`, {
      method: 'GET',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'List failed' }))
      throw new Error(error.error || `List failed with status ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get public URL for a file (served via Worker)
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
