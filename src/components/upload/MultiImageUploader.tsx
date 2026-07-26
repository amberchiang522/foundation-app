import { useState, useCallback } from 'react'
import { DropZone } from './DropZone'
import { ImageGrid } from './ImageGrid'
import { imageService, validateFile, imageConfig, type ImageType, type ImageUploadResult } from '@/services/imageService'
import { cn } from '@/lib/utils'

interface MultiImageUploaderProps {
  type: ImageType
  value?: ImageUploadResult[]
  onChange?: (images: ImageUploadResult[]) => void
  coverId?: string
  onCoverChange?: (id: string) => void
  showCoverButton?: boolean
  className?: string
  disabled?: boolean
}

export function MultiImageUploader({
  type,
  value = [],
  onChange,
  coverId,
  onCoverChange,
  showCoverButton = false,
  className,
  disabled = false,
}: MultiImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = imageConfig[type]
  const accept = type === 'receipt'
    ? 'image/*,application/pdf'
    : 'image/*'

  const remainingSlots = config.maxCount - value.length

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    // Check max count
    if (files.length > remainingSlots) {
      setError(`最多只能再上傳 ${remainingSlots} 張圖片`)
      return
    }

    // Validate all files first
    for (const file of files) {
      const validation = validateFile(file, type)
      if (!validation.valid) {
        setError(`${file.name}: ${validation.error}`)
        return
      }
    }

    setError(null)
    setIsUploading(true)

    try {
      const results = await imageService.uploadMultiple(files, type)

      // Update order based on existing images
      const startOrder = value.length
      const newImages = results.map((img, index) => ({
        ...img,
        order: startOrder + index,
      }))

      onChange?.([...value, ...newImages])

      // Auto-set first image as cover if no cover selected
      if (showCoverButton && !coverId && newImages.length > 0) {
        onCoverChange?.(newImages[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }, [type, value, remainingSlots, onChange, showCoverButton, coverId, onCoverChange])

  const handleRemove = useCallback(async (id: string) => {
    await imageService.delete(id)
    const newImages = value.filter((img) => img.id !== id)
    onChange?.(newImages)

    // If removed image was cover, set first remaining image as cover
    if (id === coverId && newImages.length > 0) {
      onCoverChange?.(newImages[0].id)
    } else if (newImages.length === 0) {
      onCoverChange?.('')
    }
  }, [value, onChange, coverId, onCoverChange])

  const handleImagesChange = useCallback((images: ImageUploadResult[]) => {
    onChange?.(images)
  }, [onChange])

  const handleSetCover = useCallback((id: string) => {
    onCoverChange?.(id)
  }, [onCoverChange])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Image Grid */}
      {value.length > 0 && (
        <ImageGrid
          images={value}
          onImagesChange={handleImagesChange}
          onRemove={handleRemove}
          onSetCover={showCoverButton ? handleSetCover : undefined}
          coverId={coverId}
          showCoverButton={showCoverButton}
          aspectRatio={config.aspectRatio}
          columns={3}
        />
      )}

      {/* Upload Zone */}
      {remainingSlots > 0 && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          accept={accept}
          multiple={remainingSlots > 1}
          disabled={disabled || isUploading}
          aspectRatio={config.aspectRatio === 'free' ? undefined : config.aspectRatio}
          className={value.length > 0 ? 'max-w-[200px]' : ''}
        />
      )}

      {/* Status */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {value.length} / {config.maxCount} 張
        </span>
        {isUploading && (
          <span className="text-muted-foreground">上傳中...</span>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
