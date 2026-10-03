import { useState, useCallback } from 'react'
import { DropZone } from './DropZone'
import { ImagePreview } from './ImagePreview'
import { imageService, validateFile, imageConfig, createPendingUpload, type ImageType, type ImageUploadResult } from '@/services/imageService'
import { cn } from '@/lib/utils'

interface ImageUploaderProps {
  type: ImageType
  value?: ImageUploadResult | null
  onChange?: (image: ImageUploadResult | null) => void
  className?: string
  disabled?: boolean
  /** If true, files are stored locally until form save. Use finalizePendingUploads to upload. */
  deferUpload?: boolean
}

export function ImageUploader({
  type,
  value,
  onChange,
  className,
  disabled = false,
  deferUpload = false,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = imageConfig[type]
  const accept = type === 'receipt'
    ? 'image/*,application/pdf'
    : 'image/*'

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    const file = files[0]
    const validation = validateFile(file, type)

    if (!validation.valid) {
      setError(validation.error || '檔案驗證失敗')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      // Delete previous image if exists and not pending
      if (value?.id && !value.pending) {
        await imageService.delete(value.id)
      } else if (value?.pending) {
        // Clean up previous pending image's blob URLs
        URL.revokeObjectURL(value.originalUrl)
        if (value.thumbnailUrl !== value.originalUrl) {
          URL.revokeObjectURL(value.thumbnailUrl)
        }
      }

      // Deferred mode: create pending upload with blob URL
      if (deferUpload) {
        const result = await createPendingUpload(file, type)
        onChange?.(result)
      } else {
        // Immediate mode: upload right away
        const result = await imageService.upload(file, type)
        onChange?.(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }, [type, value, onChange, deferUpload])

  const handleRemove = useCallback(async () => {
    if (value?.id) {
      if (value.pending) {
        // Just revoke blob URLs for pending images
        URL.revokeObjectURL(value.originalUrl)
        if (value.thumbnailUrl !== value.originalUrl) {
          URL.revokeObjectURL(value.thumbnailUrl)
        }
      } else {
        // Delete from storage for uploaded images
        await imageService.delete(value.id)
      }
      onChange?.(null)
    }
  }, [value, onChange])

  return (
    <div className={cn('space-y-2', className)}>
      {value ? (
        <ImagePreview
          src={value.originalUrl}
          fileName={value.fileName}
          onRemove={handleRemove}
          isPdf={value.mimeType === 'application/pdf'}
          aspectRatio={config.aspectRatio}
          className="w-full max-w-xs"
        />
      ) : (
        <DropZone
          onFilesSelected={handleFilesSelected}
          accept={accept}
          multiple={false}
          disabled={disabled || isUploading}
          aspectRatio={config.aspectRatio}
          className="max-w-xs"
        />
      )}

      {isUploading && (
        <p className="text-sm text-muted-foreground">上傳中...</p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
