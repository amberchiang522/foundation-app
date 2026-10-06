// Unified PDF Service - abstracts storage provider

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
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

// ============ Evaluation PDF Generation ============

export interface EvaluationPdfData {
  caseNumber: string
  caseName: string
  evaluationDate: string
  evaluationScores: Record<string, { score: number; note: string }>
  conclusion: string
  purposes: string[]
  subsidyType: 'oneTime' | 'periodic' | ''
  oneTimeMonth?: string
  oneTimeAmount?: string
  periodStart?: string
  periodEnd?: string
  frequency?: string
  periodicMonths?: string
  periodicAmount?: string
  totalScore: number
}

/**
 * Generate evaluation PDF from template and upload it
 */
export async function generateAndUploadEvaluationPdf(
  data: EvaluationPdfData
): Promise<PDFData> {
  // Load the template PDF
  const templateUrl = '/templates/evaluation-form-template.pdf'
  const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer())

  const pdfDoc = await PDFDocument.load(templateBytes)
  pdfDoc.registerFontkit(fontkit)

  // Get the first page
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { height } = firstPage.getSize()

  // Embed standard font (numbers will render correctly)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontSize = 10
  const textColor = rgb(0, 0, 0)

  // 檢查文字是否只包含 ASCII 字元
  const isAsciiOnly = (text: string): boolean => {
    return /^[\x00-\x7F]*$/.test(text)
  }

  // 個案編號（只有純 ASCII 才寫入）- 位置在「個案編號：」後面
  if (data.caseNumber && isAsciiOnly(data.caseNumber)) {
    firstPage.drawText(data.caseNumber, {
      x: 113,
      y: height - 68,
      size: fontSize,
      font,
      color: textColor,
    })
  }

  // 評核日期 - 位置在「評核日期：」後面，格式：年 月 日
  if (data.evaluationDate) {
    const dateParts = data.evaluationDate.split('-')
    if (dateParts.length >= 3) {
      // 轉換為民國年
      const rocYear = parseInt(dateParts[0]) - 1911
      firstPage.drawText(String(rocYear), { x: 480, y: height - 68, size: fontSize, font, color: textColor })
      firstPage.drawText(dateParts[1], { x: 510, y: height - 68, size: fontSize, font, color: textColor })
      firstPage.drawText(dateParts[2], { x: 540, y: height - 68, size: fontSize, font, color: textColor })
    }
  }

  // Evaluation scores - draw in the score column
  // 必須與 PlansPage.tsx 中的 EVALUATION_CRITERIA 順序一致
  const EVAL_CRITERIA = [
    { id: 'economic', maxScore: 25 },
    { id: 'family', maxScore: 20 },
    { id: 'health', maxScore: 15 },
    { id: 'living', maxScore: 15 },
    { id: 'resources', maxScore: 10 },
    { id: 'documents', maxScore: 5 },
    { id: 'committee', maxScore: 10 },
  ]
  // 調整座標以對應 PDF 模板
  // 「得分」欄位的 X 座標（在表格中間）
  const scoreX = 295
  // 「說明」欄位的 X 座標（在得分欄位右邊）
  const noteX = 360
  const noteMaxWidth = 200
  // 第一個評估項目的 Y 座標（經濟狀況）
  const scoreStartY = height - 178
  // 每行高度
  const rowHeight = 50

  EVAL_CRITERIA.forEach((criteria, index) => {
    const scoreData = data.evaluationScores[criteria.id] || { score: 0, note: '' }
    const y = scoreStartY - (index * rowHeight)

    // 寫入分數（格式：得分/滿分）
    const scoreText = `${scoreData.score || 0}/${criteria.maxScore}`
    firstPage.drawText(scoreText, {
      x: scoreX,
      y: y,
      size: fontSize,
      font,
      color: textColor,
    })

    // 寫入說明（只有純 ASCII 文字才寫入，避免中文編碼錯誤）
    if (scoreData.note && isAsciiOnly(scoreData.note)) {
      const truncatedNote = scoreData.note.length > 50 ? scoreData.note.substring(0, 50) + '...' : scoreData.note
      firstPage.drawText(truncatedNote, {
        x: noteX,
        y: y,
        size: 8,
        font,
        color: textColor,
        maxWidth: noteMaxWidth,
      })
    }
    // 如果有中文說明，暫時跳過（需要嵌入中文字型才能渲染）
  })

  // Total score（格式：共計分數/100）- 在「共計」行
  const totalY = scoreStartY - (7 * rowHeight)
  firstPage.drawText(`${data.totalScore || 0}/100`, {
    x: scoreX,
    y: totalY,
    size: fontSize,
    font,
    color: textColor,
  })

  // 綜合評估（結論文字）- 只有純 ASCII 才寫入
  // 注意：中文結論需要嵌入中文字型，目前暫時跳過
  if (data.conclusion && isAsciiOnly(data.conclusion)) {
    const conclusionY = height - 555
    const conclusionX = 58
    const maxConclusionWidth = 195
    const truncatedConclusion = data.conclusion.length > 100 ? data.conclusion.substring(0, 100) + '...' : data.conclusion
    firstPage.drawText(truncatedConclusion, {
      x: conclusionX,
      y: conclusionY,
      size: 8,
      font,
      color: textColor,
      maxWidth: maxConclusionWidth,
      lineHeight: 10,
    })
  }

  // 補助用途 checkboxes - 使用填滿方塊 ■ 標記
  // 根據 PDF 模板調整座標
  const purposeY = height - 688  // 補助用途這一行的 Y 座標
  const purposePositions: Record<string, { x: number; y: number }> = {
    '急難救助': { x: 68, y: purposeY },
    '醫療補助': { x: 126, y: purposeY },
    '教育扶助': { x: 184, y: purposeY },
    '喪葬補助': { x: 242, y: purposeY },
    '生活扶助': { x: 68, y: purposeY - 17 },
  }

  data.purposes.forEach(purpose => {
    const pos = purposePositions[purpose]
    if (pos) {
      // 使用填滿方塊標記
      firstPage.drawRectangle({
        x: pos.x,
        y: pos.y,
        width: 7,
        height: 7,
        color: textColor,
      })
    }
  })

  // 一次性補助金額 - 位置在「一次性補助金額：新台幣 _____ 元整」
  if (data.subsidyType === 'oneTime' && data.oneTimeAmount) {
    firstPage.drawText(data.oneTimeAmount, {
      x: 390,
      y: purposeY,
      size: fontSize,
      font,
      color: textColor,
    })
  }

  // 期間性補助
  const periodicY = height - 722  // 補助期間這一行的 Y 座標
  if (data.subsidyType === 'periodic') {
    // 補助期間（分開寫年月日數字）
    if (data.periodStart) {
      const startParts = data.periodStart.split('-')
      if (startParts.length >= 3) {
        const rocStartYear = parseInt(startParts[0]) - 1911
        firstPage.drawText(String(rocStartYear), { x: 95, y: periodicY, size: 9, font, color: textColor })
        firstPage.drawText(startParts[1], { x: 120, y: periodicY, size: 9, font, color: textColor })
        firstPage.drawText(startParts[2], { x: 145, y: periodicY, size: 9, font, color: textColor })
      }
    }
    if (data.periodEnd) {
      const endParts = data.periodEnd.split('-')
      if (endParts.length >= 3) {
        const rocEndYear = parseInt(endParts[0]) - 1911
        firstPage.drawText(String(rocEndYear), { x: 175, y: periodicY, size: 9, font, color: textColor })
        firstPage.drawText(endParts[1], { x: 200, y: periodicY, size: 9, font, color: textColor })
        firstPage.drawText(endParts[2], { x: 225, y: periodicY, size: 9, font, color: textColor })
      }
    }

    // 補助頻率 - 在「補助頻率」這一行
    const freqY = periodicY - 17
    if (data.frequency === 'monthly') {
      // 勾選「每月」
      firstPage.drawRectangle({
        x: 95,
        y: freqY,
        width: 7,
        height: 7,
        color: textColor,
      })
    } else if (data.frequency === 'periodic' && data.periodicMonths) {
      // 勾選「每 ___ 月為一期」
      firstPage.drawRectangle({
        x: 140,
        y: freqY,
        width: 7,
        height: 7,
        color: textColor,
      })
      firstPage.drawText(data.periodicMonths, { x: 160, y: freqY + 2, size: 9, font, color: textColor })
    }

    // 每期金額 - 在右邊的「新台幣 _____ 元整」
    if (data.periodicAmount) {
      firstPage.drawText(data.periodicAmount, {
        x: 390,
        y: freqY,
        size: fontSize,
        font,
        color: textColor,
      })
    }
  }

  // Save the PDF
  const pdfBytes = await pdfDoc.save()
  const pdfBlob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })

  // Create a File object and upload
  const fileName = `評估表_${data.caseNumber}_${new Date().toISOString().split('T')[0]}.pdf`
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

  return pdfService.upload(file)
}
