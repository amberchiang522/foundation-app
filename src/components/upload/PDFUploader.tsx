import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FileText, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useSupabase } from '@/lib/supabase'

export interface PDFData {
  id: string
  url: string
  fileName: string
  fileSize: number
  uploadedAt: string
}

interface PDFUploaderProps {
  value?: PDFData | null
  onChange?: (pdf: PDFData | null) => void
  className?: string
  disabled?: boolean
  label?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Mock PDF upload for development
async function mockUploadPDF(file: File): Promise<PDFData> {
  await new Promise(resolve => setTimeout(resolve, 1000))

  return {
    id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    url: URL.createObjectURL(file),
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

// Supabase PDF upload
async function supabaseUploadPDF(file: File): Promise<PDFData> {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const filePath = `pdfs/${timestamp}_${random}.pdf`

  const { data, error } = await supabase.storage
    .from('plans')
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    throw new Error(`上傳失敗: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('plans')
    .getPublicUrl(data.path)

  return {
    id: filePath, // Use filePath as id for deletion
    url: urlData.publicUrl,
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

// Supabase PDF delete
async function supabaseDeletePDF(pdf: PDFData): Promise<void> {
  // Extract path from URL or use id directly
  let filePath = pdf.id

  // If id doesn't look like a path, try to extract from URL
  if (!filePath.includes('/')) {
    const url = new URL(pdf.url)
    const pathParts = url.pathname.split('/storage/v1/object/public/plans/')
    if (pathParts.length > 1) {
      filePath = pathParts[1]
    }
  }

  const { error } = await supabase.storage
    .from('plans')
    .remove([filePath])

  if (error) {
    console.error('PDF delete error:', error)
  }
}

export function PDFUploader({
  value,
  onChange,
  className,
  disabled = false,
  label = '上傳 PDF',
}: PDFUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isSupabase = useSupabase

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input value to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('請上傳 PDF 檔案')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('檔案大小不能超過 10MB')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const pdfData = isSupabase
        ? await supabaseUploadPDF(file)
        : await mockUploadPDF(file)
      onChange?.(pdfData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }, [isSupabase, onChange])

  const handleRemove = useCallback(async () => {
    // Delete from Supabase if using Supabase
    if (isSupabase && value) {
      await supabaseDeletePDF(value)
    }
    onChange?.(null)
  }, [onChange, isSupabase, value])

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
