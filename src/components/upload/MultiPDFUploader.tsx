import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FileText, Upload, Trash2, Loader2, AlertCircle, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useSupabase } from '@/lib/supabase'
import type { PDFData } from './PDFUploader'

interface MultiPDFUploaderProps {
  value?: PDFData[]
  onChange?: (pdfs: PDFData[]) => void
  maxCount?: number
  className?: string
  disabled?: boolean
  label?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Mock PDF upload for development
async function mockUploadPDF(file: File): Promise<PDFData> {
  await new Promise(resolve => setTimeout(resolve, 800))

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

export function MultiPDFUploader({
  value = [],
  onChange,
  maxCount = 5,
  className,
  disabled = false,
  label = '上傳 PDF 檔案',
}: MultiPDFUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isSupabase = useSupabase

  const remainingSlots = maxCount - value.length

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    // Copy files to array BEFORE resetting input
    const files = Array.from(fileList)

    // Reset input value to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Check remaining slots
    if (files.length > remainingSlots) {
      setError(`最多只能再上傳 ${remainingSlots} 個檔案`)
      return
    }

    // Validate all files - also accept common PDF mime types
    const validPdfTypes = ['application/pdf', 'application/x-pdf']
    for (const file of files) {
      const isPdf = validPdfTypes.includes(file.type) || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        setError(`${file.name}: 請上傳 PDF 檔案`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name}: 檔案大小不能超過 10MB`)
        return
      }
    }

    setError(null)
    setIsUploading(true)

    try {
      const results: PDFData[] = []
      // Upload one by one to avoid overwhelming the server
      for (const file of files) {
        const result = isSupabase
          ? await supabaseUploadPDF(file)
          : await mockUploadPDF(file)
        results.push(result)
      }
      onChange?.([...value, ...results])
    } catch (err) {
      console.error('PDF upload error:', err)
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }, [isSupabase, onChange, value, remainingSlots])

  const handleRemove = useCallback(async (id: string) => {
    // Find the PDF to delete
    const pdfToDelete = value.find(pdf => pdf.id === id)

    // Delete from Supabase if using Supabase
    if (isSupabase && pdfToDelete) {
      await supabaseDeletePDF(pdfToDelete)
    }

    onChange?.(value.filter(pdf => pdf.id !== id))
  }, [onChange, value, isSupabase])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading || remainingSlots <= 0}
      />

      {/* Existing PDFs */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((pdf) => (
            <div
              key={pdf.id}
              className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <FileText className="h-6 w-6 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pdf.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(pdf.fileSize)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(pdf.url, '_blank')}
                  disabled={disabled}
                >
                  預覽
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(pdf.id)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {remainingSlots > 0 && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className={cn(
            'w-full p-4 border-2 border-dashed rounded-lg transition-colors text-center',
            'hover:border-primary/50 hover:bg-muted/30',
            disabled && 'opacity-50 cursor-not-allowed',
            isUploading && 'pointer-events-none'
          )}
        >
          {isUploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">上傳中...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {label} (還可上傳 {remainingSlots} 個)
              </span>
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
