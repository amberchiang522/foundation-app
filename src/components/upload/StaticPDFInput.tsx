import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FileText, ExternalLink, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StaticPDFData {
  id: string
  url: string
  fileName: string
}

interface StaticPDFInputProps {
  value?: StaticPDFData | null
  onChange?: (pdf: StaticPDFData | null) => void
  className?: string
  disabled?: boolean
  label?: string
  placeholder?: string
}

export function StaticPDFInput({
  value,
  onChange,
  className,
  disabled = false,
  label = '輸入 PDF 路徑',
  placeholder = '/pdfs/example.pdf',
}: StaticPDFInputProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    if (!inputUrl.trim()) {
      setError('請輸入 PDF 路徑')
      return
    }

    // Validate URL format
    if (!inputUrl.endsWith('.pdf') && !inputUrl.includes('.pdf')) {
      setError('請輸入有效的 PDF 路徑')
      return
    }

    // Extract filename from URL
    const fileName = inputUrl.split('/').pop() || 'document.pdf'

    setError(null)
    onChange?.({
      id: `static_${Date.now()}`,
      url: inputUrl.trim(),
      fileName,
    })
    setInputUrl('')
  }

  const handleRemove = () => {
    onChange?.(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {value ? (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <FileText className="h-6 w-6 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium truncate">{value.fileName}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {value.url.length > 40 ? value.url.substring(0, 40) + '...' : value.url}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(value.url, '_blank')}
              disabled={disabled}
              title="預覽"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              title="刪除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={disabled || !inputUrl.trim()}
          >
            確認
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {label}。檔案請放在 <code className="bg-muted px-1 rounded">public/pdfs/</code> 資料夾
      </p>
    </div>
  )
}
