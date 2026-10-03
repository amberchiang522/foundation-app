import { r2Client, type R2BucketName } from './r2Client'

// Local type definition matching main PDFData (to avoid circular import)
interface PDFData {
  id: string
  url: string
  fileName: string
  fileSize: number
  uploadedAt: string
  pending?: boolean
  file?: File
}

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10MB

class R2PDFService {
  /**
   * Upload a PDF file to R2
   */
  async upload(file: File, bucket: R2BucketName = 'plans'): Promise<PDFData> {
    // Validate file type
    if (file.type !== 'application/pdf') {
      throw new Error('只接受 PDF 檔案')
    }

    // Validate file size
    if (file.size > MAX_PDF_SIZE) {
      throw new Error('PDF 檔案大小不能超過 10MB')
    }

    const filePath = this.generatePath(file.name)

    const uploadResult = await r2Client.upload(file, bucket, filePath, 'application/pdf')

    return {
      id: `${bucket}/${filePath}`,
      url: uploadResult.url,
      fileName: file.name,
      fileSize: uploadResult.size,
      uploadedAt: new Date().toISOString(),
    }
  }

  /**
   * Upload multiple PDF files
   */
  async uploadMultiple(files: File[], bucket: R2BucketName = 'plans', maxCount = 10): Promise<PDFData[]> {
    if (files.length > maxCount) {
      throw new Error(`最多只能上傳 ${maxCount} 個 PDF 檔案`)
    }

    const results: PDFData[] = []
    for (const file of files) {
      const result = await this.upload(file, bucket)
      results.push(result)
    }
    return results
  }

  /**
   * Delete a PDF file
   */
  async delete(pdf: PDFData): Promise<void> {
    const parts = pdf.id.split('/')
    if (parts.length < 2) {
      console.error('Invalid PDF ID format:', pdf.id)
      return
    }

    const bucket = parts[0] as R2BucketName
    const path = parts.slice(1).join('/')

    await r2Client.delete(bucket, path)
  }

  /**
   * Delete PDF by ID string
   */
  async deleteById(id: string): Promise<void> {
    await this.delete({ id } as PDFData)
  }

  /**
   * Generate unique file path for PDF
   */
  private generatePath(fileName: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    return `pdfs/${timestamp}_${random}_${sanitizedName}`
  }
}

export const r2PDFService = new R2PDFService()
