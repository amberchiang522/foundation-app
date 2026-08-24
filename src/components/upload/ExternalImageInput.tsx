import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Plus, Link, Image as ImageIcon } from "lucide-react"
import type { ImageData } from "@/types"

interface ExternalImageInputProps {
  value: ImageData[]
  onChange: (images: ImageData[]) => void
  maxImages?: number
}

/**
 * 外連圖片輸入元件
 * 讓用戶貼上外部圖片網址（如 Imgur、Google Photos 等）
 * 支援批量貼入（用換行分隔）
 */
export function ExternalImageInput({
  value = [],
  onChange,
  maxImages = 50,
}: ExternalImageInputProps) {
  const [inputText, setInputText] = useState("")
  const [error, setError] = useState("")
  const [addedCount, setAddedCount] = useState(0)

  const processUrl = (url: string): string | null => {
    const trimmed = url.trim()
    if (!trimmed) return null

    // 基本 URL 驗證
    if (!trimmed.match(/^https?:\/\/.+/)) {
      return null
    }

    // 轉換 Google Drive 連結
    const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (driveMatch) {
      return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`
    }

    return trimmed
  }

  const addImages = () => {
    if (!inputText.trim()) return

    // 分割多個連結（支援換行、逗號、空格分隔）
    const urls = inputText
      .split(/[\n,]+/)
      .map(url => processUrl(url))
      .filter((url): url is string => url !== null)

    if (urls.length === 0) {
      setError("請輸入有效的圖片網址")
      return
    }

    // 過濾重複的
    const existingUrls = new Set(value.map(img => img.originalUrl))
    const newUrls = urls.filter(url => !existingUrls.has(url))

    // 檢查是否已達上限
    const remainingSlots = maxImages - value.length
    const urlsToAdd = newUrls.slice(0, remainingSlots)

    if (urlsToAdd.length === 0) {
      if (newUrls.length === 0) {
        setError("這些圖片已經新增過了")
      } else {
        setError(`已達到上限 ${maxImages} 張`)
      }
      return
    }

    const newImages: ImageData[] = urlsToAdd.map((url, index) => ({
      id: `ext-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      originalUrl: url,
      thumbnailUrl: url,
      fileName: extractFileName(url),
      fileSize: 0,
      mimeType: "image/*",
      order: value.length + index,
    }))

    onChange([...value, ...newImages])
    setInputText("")
    setError("")
    setAddedCount(urlsToAdd.length)

    // 3 秒後清除提示
    setTimeout(() => setAddedCount(0), 3000)

    // 提示是否有被過濾掉的
    const skipped = urls.length - urlsToAdd.length
    if (skipped > 0) {
      setError(`已新增 ${urlsToAdd.length} 張，跳過 ${skipped} 張（重複或超過上限）`)
    }
  }

  const removeImage = (id: string) => {
    onChange(value.filter(img => img.id !== id))
  }

  const clearAll = () => {
    if (confirm(`確定要清除全部 ${value.length} 張圖片嗎？`)) {
      onChange([])
    }
  }

  return (
    <div className="space-y-4">
      {/* 輸入區 */}
      <div className="space-y-2">
        <div className="relative">
          <Link className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value)
              setError("")
            }}
            placeholder="貼上圖片網址（支援批量貼入，每行一個連結）&#10;&#10;例如：&#10;https://lh3.googleusercontent.com/pw/xxx&#10;https://lh3.googleusercontent.com/pw/yyy"
            className="flex min-h-24 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={addImages}
            disabled={!inputText.trim() || value.length >= maxImages}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-1" />
            批量新增圖片
          </Button>
          {value.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={clearAll}
              className="text-destructive hover:text-destructive"
            >
              清除全部
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {addedCount > 0 && (
        <p className="text-sm text-green-600">成功新增 {addedCount} 張圖片</p>
      )}

      <p className="text-xs text-muted-foreground">
        支援 Google Photos 圖片連結（lh3.googleusercontent.com）、Google Drive 等。
        已新增 {value.length} / {maxImages} 張
      </p>

      {/* 圖片預覽 */}
      {value.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {value.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
            >
              <img
                src={img.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  // 圖片載入失敗時顯示佔位符
                  (e.target as HTMLImageElement).style.display = 'none'
                  const parent = (e.target as HTMLImageElement).parentElement
                  if (parent && !parent.querySelector('.error-placeholder')) {
                    const placeholder = document.createElement('div')
                    placeholder.className = 'error-placeholder absolute inset-0 flex items-center justify-center bg-muted'
                    placeholder.innerHTML = '<span class="text-xs text-muted-foreground">載入失敗</span>'
                    parent.appendChild(placeholder)
                  }
                }}
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">尚未新增任何圖片</p>
        </div>
      )}
    </div>
  )
}

function extractFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split("/")
    const lastSegment = segments[segments.length - 1]
    return lastSegment || "external-image"
  } catch {
    return "external-image"
  }
}
