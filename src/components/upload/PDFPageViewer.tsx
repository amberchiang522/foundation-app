import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFPageViewerProps {
  url: string
  className?: string
  pageHeight?: number | string
}

export function PDFPageViewer({
  url,
  className,
  pageHeight = '70vh',
}: PDFPageViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
  }

  const onDocumentLoadError = () => {
    setError('PDF 載入失敗')
    setIsLoading(false)
  }

  // Calculate dimensions
  // Mobile: use width (90vw) to fit entire page on screen
  // Desktop: use height
  const mobileWidth = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 350
  const desktopHeight = typeof pageHeight === 'string' && pageHeight.includes('vh')
    ? (parseFloat(pageHeight) / 100) * (typeof window !== 'undefined' ? window.innerHeight : 600)
    : typeof pageHeight === 'number'
      ? pageHeight
      : 600

  return (
    <Document
      file={url}
      onLoadSuccess={onDocumentLoadSuccess}
      onLoadError={onDocumentLoadError}
      loading={
        <div
          className={cn(
            "flex items-center justify-center bg-muted/20 rounded",
            "w-[90vw] md:w-auto",
            className
          )}
          style={{
            height: isMobile ? 'auto' : pageHeight,
            minHeight: isMobile ? '50vh' : undefined
          }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
      error={
        <div
          className={cn(
            "flex flex-col items-center justify-center p-4 bg-muted/20 rounded",
            "w-[90vw] md:w-auto",
            className
          )}
          style={{
            height: isMobile ? 'auto' : pageHeight,
            minHeight: isMobile ? '30vh' : undefined
          }}
        >
          <FileText className="h-12 w-12 text-red-500 mb-2" />
          <p className="text-sm text-muted-foreground">PDF 載入失敗</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline mt-2"
          >
            在新分頁開啟
          </a>
        </div>
      }
      className={cn("flex gap-4", className)}
    >
      {!isLoading && !error && numPages > 0 && (
        Array.from({ length: numPages }, (_, index) => (
          <div
            key={`page_${index + 1}`}
            className="flex-shrink-0 snap-center flex items-center justify-center"
          >
            <Page
              pageNumber={index + 1}
              width={isMobile ? mobileWidth : undefined}
              height={isMobile ? undefined : desktopHeight}
              className="shadow-lg"
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        ))
      )}
    </Document>
  )
}
