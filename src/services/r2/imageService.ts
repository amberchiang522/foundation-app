import imageCompression from 'browser-image-compression'
import type { ImageType, ImageUploadResult, ImageService } from '../imageService'
import { imageConfig, validateFile } from '../imageService'
import { r2Client, type R2BucketName } from './r2Client'

// Map image types to R2 buckets
const bucketMap: Record<ImageType, R2BucketName> = {
  'activity-cover': 'activities',
  'activity-content': 'activities',
  'volunteer-avatar': 'avatars',
  'project-result': 'projects',
  'receipt': 'projects',
  'event-review': 'activities',
  'plan-cover': 'plans',
  'forum-image': 'activities', // Using activities bucket for forum images
}

// Generate unique file path
function generateFilePath(type: ImageType, fileName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = fileName.split('.').pop() || 'jpg'
  const folder = type.replace('-', '/')
  return `${folder}/${timestamp}_${random}.${ext}`
}

class R2ImageService implements ImageService {
  async upload(file: File, type: ImageType): Promise<ImageUploadResult> {
    const validation = validateFile(file, type)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const config = imageConfig[type]
    const bucket = bucketMap[type]
    const filePath = generateFilePath(type, file.name)

    // Compress image if needed
    let uploadFile: File | Blob = file
    if (config.compress && file.type.startsWith('image/')) {
      try {
        uploadFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        })
      } catch {
        // Use original if compression fails
      }
    }

    // Upload to R2 via Worker
    const uploadResult = await r2Client.upload(uploadFile, bucket, filePath, file.type)

    const result: ImageUploadResult = {
      id: `${bucket}/${filePath}`, // Store bucket/path as ID for deletion
      originalUrl: uploadResult.url,
      thumbnailUrl: uploadResult.url, // R2 doesn't support transforms, use same URL
      fileName: file.name,
      fileSize: uploadResult.size,
      mimeType: file.type,
      order: 0,
    }

    return result
  }

  async uploadMultiple(files: File[], type: ImageType): Promise<ImageUploadResult[]> {
    const config = imageConfig[type]

    if (files.length > config.maxCount) {
      throw new Error(`最多只能上傳 ${config.maxCount} 張圖片`)
    }

    const results: ImageUploadResult[] = []
    for (let i = 0; i < files.length; i++) {
      const result = await this.upload(files[i], type)
      result.order = i
      results.push(result)
    }
    return results
  }

  async delete(id: string): Promise<void> {
    // id format: "bucket/path" e.g., "activities/activity/cover/123_abc.jpg"
    const parts = id.split('/')
    if (parts.length < 2) {
      console.error('Invalid R2 file ID format:', id)
      return
    }

    const bucket = parts[0] as R2BucketName
    const path = parts.slice(1).join('/')

    // Validate bucket name
    const validBuckets: R2BucketName[] = ['avatars', 'activities', 'projects', 'plans', 'attachments']
    if (!validBuckets.includes(bucket)) {
      // Try to determine bucket from path prefix (for backward compatibility)
      const determinedBucket = this.determineBucketFromPath(id)
      await r2Client.delete(determinedBucket, id)
      return
    }

    await r2Client.delete(bucket, path)
  }

  private determineBucketFromPath(path: string): R2BucketName {
    if (path.startsWith('activity') || path.startsWith('event-review') || path.startsWith('forum')) {
      return 'activities'
    } else if (path.startsWith('volunteer') || path.includes('avatar')) {
      return 'avatars'
    } else if (path.startsWith('project') || path.startsWith('receipt')) {
      return 'projects'
    } else if (path.startsWith('plan') || path.startsWith('pdfs')) {
      return 'plans'
    }
    return 'activities' // default
  }

  getThumbnailUrl(id: string): string {
    // For now, return same as original (no transform support)
    return this.getOriginalUrl(id)
  }

  getOriginalUrl(id: string): string {
    const parts = id.split('/')
    if (parts.length < 2) return ''

    const bucket = parts[0] as R2BucketName
    const path = parts.slice(1).join('/')

    return r2Client.getPublicUrl(bucket, path)
  }

  async generateThumbnail(file: File, type: ImageType): Promise<string> {
    if (!file.type.startsWith('image/')) {
      return '/placeholder-pdf.png'
    }

    const config = imageConfig[type]
    const { width, height } = config.thumbnailSize

    try {
      const thumbnailFile = await imageCompression(file, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: Math.max(width, height || width),
        useWebWorker: true,
      })
      return URL.createObjectURL(thumbnailFile)
    } catch {
      return URL.createObjectURL(file)
    }
  }
}

export const r2ImageService = new R2ImageService()
