import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FileText, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pdfService, createPendingPDFUpload, type PDFData } from '@/services/pdfService'

export type { PDFData }

interface PDFUploaderProps {
  value?: PDFData | null
  onChange?: (pdf: PDFData | null) => void
  className?: string
  disabled?: boolean
  label?: string
  /** If true, files are stored locally until form save. Use finalizePendingPDFUploads to upload. */
  deferUpload?: boolean
}

export function PDFUploader({
  value,
  onChange,
  className,
  disabled = false,
  label = '上傳 PDF',
  deferUpload = false,
}: PDFUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input value to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Clean up previous pending upload's blob URL
    if (value?.pending) {
      URL.revokeObjectURL(value.url)
    }

    setError(null)
    setIsUploading(true)

    try {
      // Deferred mode: create pending upload with blob URL
      if (deferUpload) {
        const pdfData = createPendingPDFUpload(file)
        onChange?.(pdfData)
      } else {
        // Immediate mode: upload right away
        const pdfData = await pdfService.upload(file)
        onChange?.(pdfData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }, [onChange, deferUpload, value])

  const handleRemove = useCallback(async () => {
    if (value) {
      if (value.pending) {
        // Just revoke blob URL for pending uploads
        URL.revokeObjectURL(value.url)
      } else {
        // Delete from storage for uploaded files
        await pdfService.delete(value)
      }
    }
    onChange?.(null)
  }, [onChange, value])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {value ? (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <FileText className="h-8 w-8 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(value.fileSize)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(value.url, '_blank')}
              disabled={disabled}
            >
              預覽
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className={cn(
            'w-full p-6 border-2 border-dashed rounded-lg transition-colors text-center',
            'hover:border-primary/50 hover:bg-muted/30',
            disabled && 'opacity-50 cursor-not-allowed',
            isUploading && 'pointer-events-none'
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">上傳中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">PDF 格式，最大 10MB</span>
            </div>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}
