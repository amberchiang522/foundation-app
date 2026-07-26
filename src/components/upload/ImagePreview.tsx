import { cn } from '@/lib/utils'
import { X, Star, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImagePreviewProps {
  src: string
  alt?: string
  fileName?: string
  onRemove?: () => void
  onSetCover?: () => void
  isCover?: boolean
  showCoverButton?: boolean
  isPdf?: boolean
  aspectRatio?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ImagePreview({
  src,
  alt = '圖片預覽',
  fileName,
  onRemove,
  onSetCover,
  isCover = false,
  showCoverButton = false,
  isPdf = false,
  aspectRatio,
  className,
  size = 'md',
}: ImagePreviewProps) {
  const sizeClasses = {
    sm: 'h-20 w-20',
    md: 'h-32 w-32',
    lg: 'h-48 w-48',
  }

  // Calculate aspect ratio style
  const getAspectStyle = () => {
    if (!aspectRatio || aspectRatio === 'free') return {}
    const [w, h] = aspectRatio.split(':').map(Number)
    return { aspectRatio: `${w}/${h}` }
  }

  return (
    <div
      className={cn(
        'relative group rounded-lg overflow-hidden bg-muted',
        !aspectRatio && sizeClasses[size],
        isCover && 'ring-2 ring-primary ring-offset-2',
        className
      )}
      style={getAspectStyle()}
    >
      {isPdf ? (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground text-center truncate max-w-full">
            {fileName || 'PDF 文件'}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      )}

      {/* Cover badge */}
      {isCover && (
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          封面
        </div>
      )}

      {/* Action buttons overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {showCoverButton && !isCover && onSetCover && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              onSetCover()
            }}
            className="h-8"
          >
            <Star className="h-3 w-3 mr-1" />
            設為封面
          </Button>
        )}
        {onRemove && (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
