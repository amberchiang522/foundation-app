import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, FolderOpen, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react"
import type { ImageData } from "@/types"

// Google Drive API Key - 從環境變數讀取
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || ""

interface GoogleDriveInputProps {
  value: ImageData[]
  onChange: (images: ImageData[]) => void
  maxImages?: number
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  thumbnailLink?: string
}

/**
 * Google Drive 資料夾圖片輸入元件
 * 貼上公開資料夾連結，自動抓取所有圖片
 */
export function GoogleDriveInput({
  value = [],
  onChange,
  maxImages = 50,
}: GoogleDriveInputProps) {
  const [folderUrl, setFolderUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [lastFolderUrl, setLastFolderUrl] = useState("")

  // 從 Google Drive 連結提取資料夾 ID
  const extractFolderId = (url: string): string | null => {
    // 格式1: https://drive.google.com/drive/folders/FOLDER_ID
    // 格式2: https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
    // 格式3: https://drive.google.com/drive/u/0/folders/FOLDER_ID
    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }

  // 將 Drive 檔案轉換成直接圖片連結
  const getDirectImageUrl = (fileId: string): string => {
    // 使用 lh3.googleusercontent.com 格式，更穩定
    return `https://lh3.googleusercontent.com/d/${fileId}`
  }

  // 取得縮圖連結（較小尺寸，載入較快）
  const getThumbnailUrl = (fileId: string): string => {
    // 加上尺寸參數
    return `https://lh3.googleusercontent.com/d/${fileId}=w400`
  }

  const fetchImages = async () => {
    if (!folderUrl.trim()) return

    const folderId = extractFolderId(folderUrl)
    if (!folderId) {
      setError("請輸入有效的 Google Drive 資料夾連結")
      return
    }

    if (!GOOGLE_API_KEY) {
      setError("未設定 Google API Key，請聯繫管理員")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // 使用 Google Drive API 列出資料夾內的圖片檔案
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?` +
        `q='${folderId}'+in+parents+and+(mimeType+contains+'image/')` +
        `&fields=files(id,name,mimeType,thumbnailLink)` +
        `&pageSize=100` +
        `&key=${GOOGLE_API_KEY}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Drive API error:", errorData)

        if (response.status === 404) {
          throw new Error("找不到資料夾，請確認連結正確且資料夾已設為公開")
        } else if (response.status === 403) {
          throw new Error("無法存取資料夾，請確認資料夾已設為「任何人都可以查看」")
        } else {
          throw new Error("讀取資料夾失敗，請稍後再試")
        }
      }

      const data = await response.json()
      const files: DriveFile[] = data.files || []

      if (files.length === 0) {
        setError("資料夾內沒有圖片檔案")
        return
      }

      // 過濾已存在的圖片
      const existingIds = new Set(
        value
          .map(img => {
            const match = img.originalUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
            return match ? match[1] : null
          })
          .filter(Boolean)
      )

      const newFiles = files.filter(f => !existingIds.has(f.id))

      // 限制數量
      const remainingSlots = maxImages - value.length
      const filesToAdd = newFiles.slice(0, remainingSlots)

      if (filesToAdd.length === 0) {
        if (newFiles.length === 0) {
          setError("這些圖片已經新增過了")
        } else {
          setError(`已達到上限 ${maxImages} 張`)
        }
        return
      }

      // 轉換成 ImageData 格式
      const newImages: ImageData[] = filesToAdd.map((file, index) => ({
        id: `gdrive-${file.id}`,
        originalUrl: getDirectImageUrl(file.id),
        thumbnailUrl: getThumbnailUrl(file.id),
        fileName: file.name,
        fileSize: 0,
        mimeType: file.mimeType,
        order: value.length + index,
      }))

      onChange([...value, ...newImages])
      setLastFolderUrl(folderUrl)
      setFolderUrl("")

      // 提示結果
      const skipped = files.length - filesToAdd.length
      if (skipped > 0) {
        setError(`已新增 ${filesToAdd.length} 張，跳過 ${skipped} 張（重複或超過上限）`)
      }

    } catch (err) {
      console.error("Failed to fetch Drive images:", err)
      setError(err instanceof Error ? err.message : "讀取失敗，請稍後再試")
    } finally {
      setIsLoading(false)
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

  const refresh = () => {
    if (lastFolderUrl) {
      setFolderUrl(lastFolderUrl)
      fetchImages()
    }
  }

  return (
    <div className="space-y-4">
      {/* 輸入區 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={folderUrl}
              onChange={(e) => {
                setFolderUrl(e.target.value)
                setError("")
              }}
              placeholder="貼上 Google Drive 公開資料夾連結"
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <Button
            type="button"
            onClick={fetchImages}
            disabled={!folderUrl.trim() || isLoading || value.length >= maxImages}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "抓取圖片"
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          請確認資料夾已設為「任何人都可以查看」。
          已新增 {value.length} / {maxImages} 張
        </p>
      </div>

      {error && (
        <p className={`text-sm ${error.includes("已新增") ? "text-amber-600" : "text-destructive"}`}>
          {error}
        </p>
      )}

      {/* 圖片預覽 */}
      {value.length > 0 && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              共 {value.length} 張圖片
            </span>
            <div className="flex gap-2">
              {lastFolderUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={refresh}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  重新抓取
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="text-destructive hover:text-destructive"
              >
                清除全部
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {value.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
              >
                <img
                  src={img.thumbnailUrl}
                  alt={img.fileName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // 縮圖載入失敗時嘗試原圖
                    const target = e.target as HTMLImageElement
                    if (target.src !== img.originalUrl) {
                      target.src = img.originalUrl
                    } else {
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent && !parent.querySelector('.error-placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'error-placeholder absolute inset-0 flex items-center justify-center bg-muted'
                        placeholder.innerHTML = '<span class="text-xs text-muted-foreground">載入失敗</span>'
                        parent.appendChild(placeholder)
                      }
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
        </>
      )}

      {value.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">貼上 Google Drive 資料夾連結來新增圖片</p>
        </div>
      )}
    </div>
  )
}
