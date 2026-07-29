import { supabase } from '@/lib/supabase'
import imageCompression from 'browser-image-compression'
import type { ImageType, ImageUploadResult, ImageService } from '../imageService'
import { imageConfig, validateFile } from '../imageService'

// Map image types to storage buckets
const bucketMap: Record<ImageType, string> = {
  'activity-cover': 'activities',
  'activity-content': 'activities',
  'volunteer-avatar': 'avatars',
  'project-result': 'projects',
  'receipt': 'projects',
}

// Generate unique file path
function generateFilePath(type: ImageType, fileName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = fileName.split('.').pop() || 'jpg'
  const folder = type.replace('-', '/')
  return `${folder}/${timestamp}_${random}.${ext}`
}

class SupabaseImageService implements ImageService {
  async upload(file: File, type: ImageType): Promise<ImageUploadResult> {
    const validation = validateFile(file, type)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const config = imageConfig[type]
    const bucket = bucketMap[type]
    const filePath = generateFilePath(type, file.name)

    // Compress image if needed
    let uploadFile = file
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

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, uploadFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      throw new Error(`上傳失敗: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    const publicUrl = urlData.publicUrl

    // Generate thumbnail (for now, use same URL with transform params if supported)
    // Supabase doesn't support image transforms in free tier, so we use same URL
    const thumbnailUrl = publicUrl

    const result: ImageUploadResult = {
      id: data.path, // Use storage path as ID
      originalUrl: publicUrl,
      thumbnailUrl: thumbnailUrl,
      fileName: file.name,
      fileSize: uploadFile.size,
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
    // id is the storage path, need to determine bucket from path
    let bucket = 'activities' // default

    if (id.startsWith('activity')) {
      bucket = 'activities'
    } else if (id.startsWith('volunteer') || id.includes('avatar')) {
      bucket = 'avatars'
    } else if (id.startsWith('project') || id.startsWith('receipt')) {
      bucket = 'projects'
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([id])

    if (error) {
      console.error('Delete error:', error)
      // Don't throw - file might already be deleted
    }
  }

  getThumbnailUrl(id: string): string {
    // For now, return same as original
    return this.getOriginalUrl(id)
  }

  getOriginalUrl(id: string): string {
    // Determine bucket from path
    let bucket = 'activities'
    if (id.startsWith('volunteer') || id.includes('avatar')) {
      bucket = 'avatars'
    } else if (id.startsWith('project') || id.startsWith('receipt')) {
      bucket = 'projects'
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(id)

    return data.publicUrl
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

export const supabaseImageService = new SupabaseImageService()
