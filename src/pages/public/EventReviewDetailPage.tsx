import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { eventReviewService } from "@/services"
import type { EventReviewWithDetails } from "@/types"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Share2,
  Download,
  X,
} from "lucide-react"

// 底片樣式配置
const FRAME_OPTIONS = [
  { id: "frame-1", name: "底片 1" },
  { id: "frame-2", name: "底片 2" },
]

const RATIO_OPTIONS = [
  { id: "9x16", name: "9:16", width: 1080, height: 1920 },
  { id: "4x5", name: "4:5", width: 1080, height: 1350 },
]

export function EventReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [review, setReview] = useState<EventReviewWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // View mode: "grid" or "single"
  const [viewMode, setViewMode] = useState<"grid" | "single">("grid")
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Share dialog state
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [selectedRatio, setSelectedRatio] = useState(RATIO_OPTIONS[0])
  const [selectedFrame, setSelectedFrame] = useState(FRAME_OPTIONS[0])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadReview()
  }, [id])

  const loadReview = async () => {
    if (!id) {
      setError("找不到活動回顧")
      setIsLoading(false)
      return
    }

    try {
      const data = await eventReviewService.getReviewById(id)
      if (!data) {
        setError("找不到此活動回顧")
      } else if (!data.isPublished) {
        setError("此活動回顧尚未發布")
      } else {
        setReview(data)
      }
    } catch (err) {
      console.error("Failed to load review:", err)
      setError("載入失敗，請稍後再試")
    } finally {
      setIsLoading(false)
    }
  }

  const openImage = (index: number) => {
    setCurrentImageIndex(index)
    setViewMode("single")
  }

  const closeImage = () => {
    setViewMode("grid")
  }

  const nextImage = () => {
    if (review && review.images) {
      setCurrentImageIndex((prev) =>
        prev < review.images.length - 1 ? prev + 1 : 0
      )
    }
  }

  const prevImage = () => {
    if (review && review.images) {
      setCurrentImageIndex((prev) =>
        prev > 0 ? prev - 1 : review.images.length - 1
      )
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShareOpen) return
      if (viewMode === "single") {
        if (e.key === "ArrowRight") nextImage()
        if (e.key === "ArrowLeft") prevImage()
        if (e.key === "Escape") closeImage()
      } else {
        if (e.key === "Escape") navigate("/events")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [review, isShareOpen, viewMode])

  // Prevent right-click on images
  const preventContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  // Generate preview with frame
  const generatePreview = async () => {
    if (!review?.images?.[currentImageIndex]) return

    setIsGenerating(true)

    try {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Set canvas size based on ratio
      canvas.width = selectedRatio.width
      canvas.height = selectedRatio.height

      // Load the photo
      const photo = new Image()
      photo.crossOrigin = "anonymous"

      await new Promise<void>((resolve, reject) => {
        photo.onload = () => resolve()
        photo.onerror = () => reject(new Error("Failed to load photo"))
        photo.src = review.images[currentImageIndex].originalUrl
      })

      // Calculate photo dimensions to cover canvas (crop to fit)
      const photoRatio = photo.width / photo.height
      const canvasRatio = canvas.width / canvas.height

      let drawWidth, drawHeight, drawX, drawY

      if (photoRatio > canvasRatio) {
        drawHeight = canvas.height
        drawWidth = drawHeight * photoRatio
        drawX = (canvas.width - drawWidth) / 2
        drawY = 0
      } else {
        drawWidth = canvas.width
        drawHeight = drawWidth / photoRatio
        drawX = 0
        drawY = (canvas.height - drawHeight) / 2
      }

      // Draw photo
      ctx.drawImage(photo, drawX, drawY, drawWidth, drawHeight)

      // Load and draw frame overlay
      const frame = new Image()
      frame.crossOrigin = "anonymous"

      await new Promise<void>((resolve) => {
        frame.onload = () => resolve()
        frame.onerror = () => {
          console.warn("Frame not found, using photo only")
          resolve()
        }
        frame.src = `/frames/${selectedFrame.id}-${selectedRatio.id}.png`
      })

      if (frame.complete && frame.naturalWidth > 0) {
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
      setPreviewUrl(dataUrl)

    } catch (err) {
      console.error("Failed to generate preview:", err)
      alert("產生預覽失敗，請稍後再試")
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (isShareOpen) {
      generatePreview()
    }
  }, [isShareOpen, selectedRatio, selectedFrame])

  const handleDownload = () => {
    if (!previewUrl) return

    const link = document.createElement("a")
    link.href = previewUrl
    link.download = `${review?.title || "photo"}-${Date.now()}.jpg`
    link.click()
  }

  const openShareDialog = () => {
    setPreviewUrl(null)
    setIsShareOpen(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">{error || "找不到活動回顧"}</h2>
          <Button variant="outline" onClick={() => navigate("/events")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回活動回顧
          </Button>
        </div>
      </div>
    )
  }

  const hasImages = review.images && review.images.length > 0
  const currentImage = hasImages ? review.images[currentImageIndex] : null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/events")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="font-bold">{review.title}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {review.plan && <span className="text-primary">{review.plan.name}</span>}
                  {review.eventDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(review.eventDate), "yyyy年M月d日", { locale: zhTW })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {hasImages && (
              <span className="text-sm text-muted-foreground">
                共 {review.images.length} 張照片
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Description */}
        {review.content && (
          <div className="mb-6 max-w-3xl">
            <p className="text-muted-foreground whitespace-pre-wrap">{review.content}</p>
          </div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && hasImages && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {review.images.map((img, idx) => (
              <div
                key={img.id}
                onClick={() => openImage(idx)}
                className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
              >
                <img
                  src={img.thumbnailUrl || img.originalUrl}
                  alt={`${review.title} - ${idx + 1}`}
                  className="w-full h-full object-cover select-none"
                  onContextMenu={preventContextMenu}
                  draggable={false}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Single View */}
        {viewMode === "single" && hasImages && currentImage && (
          <div className="relative max-w-4xl mx-auto">
            {/* Close Button */}
            <div className="flex justify-end mb-4 gap-2">
              <Button variant="outline" size="sm" onClick={openShareDialog}>
                <Share2 className="h-4 w-4 mr-1" />
                分享
              </Button>
              <Button variant="ghost" size="sm" onClick={closeImage}>
                <X className="h-4 w-4 mr-1" />
                關閉
              </Button>
            </div>

            {/* Main Image */}
            <div className="relative bg-muted rounded-xl overflow-hidden">
              <img
                src={currentImage.originalUrl}
                alt={`${review.title} - ${currentImageIndex + 1}`}
                className="w-full h-auto max-h-[70vh] object-contain mx-auto select-none"
                onContextMenu={preventContextMenu}
                draggable={false}
              />

              {/* Navigation Arrows */}
              {review.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background shadow-lg transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background shadow-lg transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            {/* Image Counter */}
            <div className="text-center mt-4 text-sm text-muted-foreground">
              {currentImageIndex + 1} / {review.images.length}
            </div>

            {/* Thumbnails */}
            {review.images.length > 1 && (
              <div className="mt-4 flex justify-center gap-2 overflow-x-auto pb-2">
                {review.images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                      idx === currentImageIndex
                        ? "border-primary"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.thumbnailUrl || img.originalUrl}
                      alt=""
                      className="w-full h-full object-cover select-none"
                      onContextMenu={preventContextMenu}
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>分享照片</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Ratio Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">選擇比例</label>
              <div className="flex gap-2">
                {RATIO_OPTIONS.map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                      selectedRatio.id === ratio.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {ratio.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">選擇底片樣式</label>
              <div className="flex gap-2">
                {FRAME_OPTIONS.map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => setSelectedFrame(frame)}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                      selectedFrame.id === frame.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {frame.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium">預覽</label>
              <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                {isGenerating ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-[300px] rounded-lg shadow-lg"
                  />
                ) : (
                  <span className="text-muted-foreground">產生預覽中...</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsShareOpen(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleDownload}
                disabled={!previewUrl || isGenerating}
              >
                <Download className="h-4 w-4 mr-1" />
                下載
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
