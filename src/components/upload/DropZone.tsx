import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, ImageIcon } from 'lucide-react'

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  aspectRatio?: string
  children?: React.ReactNode
}

export function DropZone({
  onFilesSelected,
  accept = 'image/*',
  multiple = false,
  disabled = false,
  className,
  aspectRatio,
  children,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]])
    }
  }, [disabled, multiple, onFilesSelected])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]])
    }
    // Reset input
    e.target.value = ''
  }, [multiple, onFilesSelected])

  // Calculate aspect ratio style
  const getAspectStyle = () => {
    if (!aspectRatio || aspectRatio === 'free') return {}
    const [w, h] = aspectRatio.split(':').map(Number)
    return { aspectRatio: `${w}/${h}` }
  }

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg transition-colors cursor-pointer',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={getAspectStyle()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />

      {children || (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[120px]">
          <div className={cn(
            'rounded-full p-3 mb-3',
            isDragging ? 'bg-primary/10' : 'bg-muted'
          )}>
            {isDragging ? (
              <Upload className="h-6 w-6 text-primary" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground">
            {isDragging ? '放開以上傳' : '點擊或拖曳上傳'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {multiple ? '支援多張圖片' : '單張圖片'}
            {aspectRatio && aspectRatio !== 'free' && ` · 建議比例 ${aspectRatio}`}
          </p>
        </div>
      )}
    </div>
  )
}
