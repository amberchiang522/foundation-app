import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FileText, ExternalLink, Trash2, Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StaticPDFData } from './StaticPDFInput'

interface StaticMultiPDFInputProps {
  value?: StaticPDFData[]
  onChange?: (pdfs: StaticPDFData[]) => void
  maxCount?: number
  className?: string
  disabled?: boolean
  label?: string
}

export function StaticMultiPDFInput({
  value = [],
  onChange,
  maxCount = 10,
  className,
  disabled = false,
  label = '新增下載檔案',
}: StaticMultiPDFInputProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [inputName, setInputName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const remainingSlots = maxCount - value.length

  const handleAdd = () => {
    if (!inputUrl.trim()) {
      setError('請輸入 PDF 路徑')
      return
    }

    if (!inputUrl.endsWith('.pdf') && !inputUrl.includes('.pdf')) {
      setError('請輸入有效的 PDF 路徑')
      return
    }

    // Use custom name or extract from URL
    const fileName = inputName.trim() || inputUrl.split('/').pop() || 'document.pdf'

    setError(null)
    onChange?.([
      ...value,
      {
        id: `static_${Date.now()}`,
        url: inputUrl.trim(),
        fileName,
      },
    ])
    setInputUrl('')
    setInputName('')
    setIsAdding(false)
  }

  const handleRemove = (id: string) => {
    onChange?.(value.filter((pdf) => pdf.id !== id))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Existing PDFs */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((pdf) => (
            <div
              key={pdf.id}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
            >
              <FileText className="h-6 w-6 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-medium truncate">{pdf.fileName}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {pdf.url.length > 40 ? pdf.url.substring(0, 40) + '...' : pdf.url}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(pdf.url, '_blank')}
                  disabled={disabled}
                  title="預覽"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(pdf.id)}
                  disabled={disabled}
                  title="刪除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new PDF */}
      {remainingSlots > 0 && (
        <>
          {isAdding ? (
            <div className="space-y-2 p-3 border-2 border-dashed rounded-lg">
              <Input
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="顯示名稱（選填）"
                disabled={disabled}
              />
              <div className="flex gap-2">
                <Input
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="/pdfs/document.pdf"
                  disabled={disabled}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={disabled || !inputUrl.trim()}
                  size="sm"
                >
                  確認
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false)
                    setInputUrl('')
                    setInputName('')
                    setError(null)
                  }}
                  disabled={disabled}
                  size="sm"
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAdding(true)}
              disabled={disabled}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {label} (還可新增 {remainingSlots} 個)
            </Button>
          )}
        </>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        檔案請放在 <code className="bg-muted px-1 rounded">public/pdfs/</code> 資料夾
      </p>
    </div>
  )
}
