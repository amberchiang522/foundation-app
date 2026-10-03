// Unified PDF Service - abstracts storage provider

import { supabase } from '@/lib/supabase'
import { storageProvider } from './imageService'
import { r2PDFService } from './r2/pdfService'

export interface PDFData {
  id: string
  url: string
  fileName: string
  fileSize: number
  uploadedAt: string
  // For deferred uploads
  pending?: boolean
  file?: File
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
    id: filePath,
    url: urlData.publicUrl,
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

// Supabase PDF delete
async function supabaseDeletePDF(pdf: PDFData): Promise<void> {
  let filePath = pdf.id

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

class PDFService {
  async upload(file: File): Promise<PDFData> {
    // Validate file type
    if (file.type !== 'application/pdf') {
      throw new Error('請上傳 PDF 檔案')
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('檔案大小不能超過 10MB')
    }

    switch (storageProvider) {
      case 'r2':
        return r2PDFService.upload(file)
      case 'supabase':
        return supabaseUploadPDF(file)
      default:
        return mockUploadPDF(file)
    }
  }

  async uploadMultiple(files: File[], maxCount = 10): Promise<PDFData[]> {
    if (files.length > maxCount) {
      throw new Error(`最多只能上傳 ${maxCount} 個 PDF 檔案`)
    }

    const results: PDFData[] = []
    for (const file of files) {
      const result = await this.upload(file)
      results.push(result)
    }
    return results
  }

  async delete(pdf: PDFData): Promise<void> {
    switch (storageProvider) {
      case 'r2':
        return r2PDFService.delete(pdf)
      case 'supabase':
        return supabaseDeletePDF(pdf)
      default:
        // Mock - just revoke the blob URL
        if (pdf.url.startsWith('blob:')) {
          URL.revokeObjectURL(pdf.url)
        }
    }
  }
}

export const pdfService = new PDFService()

// ============ Deferred Upload Support ============

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Create a pending PDF upload for deferred uploading.
 * This stores the file locally with a blob URL for preview.
 * Call `finalizePendingPDFUploads` to actually upload the files.
 */
export function createPendingPDFUpload(file: File): PDFData {
  if (file.type !== 'application/pdf') {
    throw new Error('請上傳 PDF 檔案')
  }

  if (file.size > MAX_PDF_SIZE) {
    throw new Error('檔案大小不能超過 10MB')
  }

  return {
    id: `pending_pdf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    url: URL.createObjectURL(file),
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    pending: true,
    file,
  }
}

/**
 * Create multiple pending PDF uploads
 */
export function createPendingPDFUploads(files: File[], maxCount = 10): PDFData[] {
  if (files.length > maxCount) {
    throw new Error(`最多只能上傳 ${maxCount} 個 PDF 檔案`)
  }

  return files.map(file => createPendingPDFUpload(file))
}

/**
 * Finalize pending PDF uploads - actually upload files to storage.
 * Call this when saving the form.
 */
export async function finalizePendingPDFUploads(pdfs: PDFData[]): Promise<PDFData[]> {
  const results: PDFData[] = []

  for (const pdf of pdfs) {
    if (pdf.pending && pdf.file) {
      // Upload the file
      const uploaded = await pdfService.upload(pdf.file)
      results.push(uploaded)

      // Clean up blob URL
      URL.revokeObjectURL(pdf.url)
    } else {
      // Already uploaded, keep as-is
      results.push(pdf)
    }
  }

  return results
}

/**
 * Clean up pending PDF uploads (revoke blob URLs).
 * Call this when canceling/closing a form without saving.
 */
export function cleanupPendingPDFUploads(pdfs: PDFData[]): void {
  for (const pdf of pdfs) {
    if (pdf.pending) {
      URL.revokeObjectURL(pdf.url)
    }
  }
}
