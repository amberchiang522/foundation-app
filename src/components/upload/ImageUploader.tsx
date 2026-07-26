import { useState, useCallback } from 'react'
import { DropZone } from './DropZone'
import { ImagePreview } from './ImagePreview'
import { imageService, validateFile, imageConfig, type ImageType, type ImageUploadResult } from '@/services/imageService'
import { cn } from '@/lib/utils'

interface ImageUploaderProps {
  type: ImageType
  value?: ImageUploadResult | null
  onChange?: (image: ImageUploadResult | null) => void
  className?: string
  disabled?: boolean
}

export function ImageUploader({
  type,
  value,
  onChange,
  className,
  disabled = false,
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
      // Delete previous image if exists
      if (value?.id) {
        await imageService.delete(value.id)
      }

      const result = await imageService.upload(file, type)
      onChange?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }, [type, value, onChange])

  const handleRemove = useCallback(async () => {
    if (value?.id) {
      await imageService.delete(value.id)
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
