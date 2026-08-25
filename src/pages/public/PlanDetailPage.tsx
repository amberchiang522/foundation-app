import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

// Custom styles for continuous PDF display
const pdfStyles = `
  .react-pdf__Document {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .react-pdf__Page {
    margin-bottom: 0 !important;
    box-shadow: none !important;
  }
  .react-pdf__Page canvas {
    display: block;
  }
`
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { planPublicService } from "@/services"
import type { PlanPublicInfo } from "@/types"
import { ArrowLeft, Download, FileText, Images, ExternalLink } from "lucide-react"

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanPublicInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // PDF state
  const [numPages, setNumPages] = useState<number>(0)
  const [pdfWidth, setPdfWidth] = useState(800)

  // 頁面載入時滾動到頂部
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const loadPlan = async () => {
      if (!id) {
        setError("找不到計畫")
        setIsLoading(false)
        return
      }

      try {
        // 使用公開計畫服務（不需登入即可取得）
        const data = await planPublicService.getPublicPlanById(id)
        if (!data) {
          setError("找不到此計畫")
        } else {
          setPlan(data)
        }
      } catch (err) {
        console.error("Failed to load plan:", err)
        setError("載入計畫時發生錯誤")
      } finally {
        setIsLoading(false)
      }
    }

    loadPlan()
  }, [id])

  // Responsive PDF width - full container width
  useEffect(() => {
    const updateWidth = () => {
      // Get container width (max-w-6xl = 1152px, with padding)
      const maxWidth = Math.min(window.innerWidth - 32, 1152 - 32)
      setPdfWidth(maxWidth)
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-r-transparent mb-4" />
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || "找不到計畫"}</h2>
            <p className="text-muted-foreground mb-6">
              請確認計畫連結是否正確，或返回首頁瀏覽其他計畫。
            </p>
            <Button onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首頁
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <style>{pdfStyles}</style>
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首頁
              </Button>
              <h1 className="text-xl font-bold">{plan.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {plan.downloadPdfs && plan.downloadPdfs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    document.getElementById('download-section')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  檔案下載
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/events?plan=${plan.planId}`)}
              >
                <Images className="h-4 w-4 mr-2" />
                活動回顧
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Description */}
        {plan.publicDescription && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-muted-foreground whitespace-pre-wrap">
                {plan.publicDescription}
              </p>
            </CardContent>
          </Card>
        )}

        {/* PDF Viewer */}
        {plan.introPdf ? (
          <div className="flex flex-col items-center">
            {/* PDF Document - All Pages */}
            <Document
              file={plan.introPdf.url}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-20">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-r-transparent" />
                </div>
              }
              error={
                <Card className="w-full">
                  <CardContent className="py-16 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">無法載入 PDF</h3>
                    <p className="text-muted-foreground mb-4">
                      請嘗試重新整理頁面或使用新視窗開啟
                    </p>
                    <Button variant="outline" asChild>
                      <a href={plan.introPdf.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        新視窗開啟
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              }
            >
              {/* Render all pages continuously without gaps */}
              <div className="shadow-lg rounded-lg overflow-hidden">
                {Array.from(new Array(numPages), (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    width={pdfWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                ))}
              </div>
            </Document>
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">尚無介紹文件</h3>
              <p className="text-muted-foreground">
                此計畫尚未上傳詳細介紹文件
              </p>
            </CardContent>
          </Card>
        )}

        {/* Download PDFs */}
        {plan.downloadPdfs && plan.downloadPdfs.length > 0 && (
          <div id="download-section" className="mt-8">
            <h3 className="font-medium mb-4 text-center">相關文件下載</h3>
            <div className="flex flex-wrap justify-center gap-6">
              {plan.downloadPdfs.map((pdf) => (
                <a
                  key={pdf.id}
                  href={pdf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="relative">
                    <FileText className="h-12 w-12 text-red-500" />
                    <Download className="h-4 w-4 text-muted-foreground absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-center max-w-[120px] truncate">{pdf.fileName}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
