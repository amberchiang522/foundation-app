import imageCompression from 'browser-image-compression'

// Image Types
export type ImageType =
  | 'activity-cover'      // 活動封面圖
  | 'activity-content'    // 活動內容圖片
  | 'volunteer-avatar'    // 志工大頭照
  | 'project-result'      // 專案成果圖
  | 'receipt'             // 收據單據

// Image configuration per type
export const imageConfig: Record<ImageType, {
  aspectRatio: string
  maxCount: number
  required: boolean
  compress: boolean
  thumbnailSize: { width: number; height: number }
}> = {
  'activity-cover': {
    aspectRatio: '4:3',
    maxCount: 1,
    required: true,
    compress: false,
    thumbnailSize: { width: 400, height: 300 },
  },
  'activity-content': {
    aspectRatio: '16:9',
    maxCount: 5,
    required: false,
    compress: true,
    thumbnailSize: { width: 400, height: 225 },
  },
  'volunteer-avatar': {
    aspectRatio: '1:1',
    maxCount: 1,
    required: true,
    compress: false,
    thumbnailSize: { width: 100, height: 100 },
  },
  'project-result': {
    aspectRatio: '16:9',
    maxCount: 5,
    required: false,
    compress: true,
    thumbnailSize: { width: 400, height: 225 },
  },
  'receipt': {
    aspectRatio: 'free',
    maxCount: 5,
    required: true,
    compress: false,
    thumbnailSize: { width: 300, height: 0 }, // auto height
  },
}

export interface ImageUploadResult {
  id: string
  originalUrl: string
  thumbnailUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  order: number
}

export interface ImageService {
  upload(file: File, type: ImageType): Promise<ImageUploadResult>
  uploadMultiple(files: File[], type: ImageType): Promise<ImageUploadResult[]>
  delete(id: string): Promise<void>
  getThumbnailUrl(id: string): string
  getOriginalUrl(id: string): string
  generateThumbnail(file: File, type: ImageType): Promise<string>
}

// Validation
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED_RECEIPT_TYPES = [...ACCEPTED_IMAGE_TYPES, 'application/pdf']

export function validateFile(file: File, type: ImageType): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `檔案大小超過 2MB 限制` }
  }

  // Check file type
  const acceptedTypes = type === 'receipt' ? ACCEPTED_RECEIPT_TYPES : ACCEPTED_IMAGE_TYPES
  if (!acceptedTypes.includes(file.type)) {
    return { valid: false, error: `不支援的檔案格式` }
  }

  return { valid: true }
}

// Generate unique ID
function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Unsplash categories for mock images
const unsplashCategories: Record<ImageType, string> = {
  'activity-cover': 'volunteer,community,teamwork',
  'activity-content': 'event,workshop,seminar',
  'volunteer-avatar': 'portrait,face',
  'project-result': 'achievement,success,community',
  'receipt': 'document,paper',
}

// Mock Image Service for Phase 1
class MockImageService implements ImageService {
  private imageStore: Map<string, ImageUploadResult> = new Map()

  async upload(file: File, type: ImageType): Promise<ImageUploadResult> {
    const validation = validateFile(file, type)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const config = imageConfig[type]
    const id = generateId()

    // Generate preview URL using createObjectURL
    let originalUrl = URL.createObjectURL(file)

    // Apply compression if needed
    if (config.compress && file.type.startsWith('image/')) {
      try {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        })
        originalUrl = URL.createObjectURL(compressedFile)
      } catch {
        // Use original if compression fails
      }
    }

    // Generate thumbnail URL (in mock, same as original for now)
    const thumbnailUrl = await this.generateThumbnail(file, type)

    const result: ImageUploadResult = {
      id,
      originalUrl,
      thumbnailUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      order: 0,
    }

    this.imageStore.set(id, result)
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
    const image = this.imageStore.get(id)
    if (image) {
      // Revoke object URLs to free memory
      URL.revokeObjectURL(image.originalUrl)
      if (image.thumbnailUrl !== image.originalUrl) {
        URL.revokeObjectURL(image.thumbnailUrl)
      }
      this.imageStore.delete(id)
    }
  }

  getThumbnailUrl(id: string): string {
    const image = this.imageStore.get(id)
    return image?.thumbnailUrl || ''
  }

  getOriginalUrl(id: string): string {
    const image = this.imageStore.get(id)
    return image?.originalUrl || ''
  }

  async generateThumbnail(file: File, type: ImageType): Promise<string> {
    if (!file.type.startsWith('image/')) {
      // For PDFs, use a placeholder
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

  // Mock methods for generating placeholder images
  getMockAvatarUrl(seed?: string | number): string {
    const id = seed || Math.floor(Math.random() * 70)
    return `https://i.pravatar.cc/150?img=${id}`
  }

  getMockImageUrl(type: ImageType, width = 800, height = 600): string {
    const category = unsplashCategories[type]
    const seed = Math.random().toString(36).substring(7)
    return `https://source.unsplash.com/${width}x${height}/?${category}&sig=${seed}`
  }
}

// Export singleton instance
export const imageService = new MockImageService()
