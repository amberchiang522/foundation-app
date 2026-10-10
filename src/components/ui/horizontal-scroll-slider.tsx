import { useRef, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface HorizontalScrollSliderProps {
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function HorizontalScrollSlider({
  children,
  className,
  contentClassName,
}: HorizontalScrollSliderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Check if content overflows
  const checkOverflow = useCallback(() => {
    const container = scrollContainerRef.current
    if (container) {
      setHasOverflow(container.scrollWidth > container.clientWidth)
    }
  }, [])

  // Update slider when scroll changes
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (container) {
      const maxScroll = container.scrollWidth - container.clientWidth
      if (maxScroll > 0) {
        setScrollProgress((container.scrollLeft / maxScroll) * 100)
      }
    }
  }, [])

  // Update scroll when slider changes
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const container = scrollContainerRef.current
    if (container) {
      const maxScroll = container.scrollWidth - container.clientWidth
      container.scrollLeft = (parseFloat(e.target.value) / 100) * maxScroll
    }
  }, [])

  useEffect(() => {
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [checkOverflow])

  // Recheck overflow when children change
  useEffect(() => {
    const timer = setTimeout(checkOverflow, 100)
    return () => clearTimeout(timer)
  }, [children, checkOverflow])

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide",
          // Only use snap on desktop for smoother mobile scrolling
          "md:snap-x md:snap-none",
          contentClassName
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>

      {/* Custom slider - only show on desktop when content overflows */}
      {hasOverflow && !isMobile && (
        <div className="px-4 -mx-4">
          <input
            type="range"
            min="0"
            max="100"
            value={scrollProgress}
            onChange={handleSliderChange}
            className="w-full h-3 appearance-none bg-muted rounded-full cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-16
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:bg-primary
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-grab
              [&::-webkit-slider-thumb]:active:cursor-grabbing
              [&::-webkit-slider-thumb]:hover:bg-primary/90
              [&::-moz-range-thumb]:w-16
              [&::-moz-range-thumb]:h-3
              [&::-moz-range-thumb]:bg-primary
              [&::-moz-range-thumb]:border-none
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:cursor-grab
              [&::-moz-range-thumb]:active:cursor-grabbing
              [&::-moz-range-track]:bg-muted
              [&::-moz-range-track]:rounded-full"
          />
        </div>
      )}
    </div>
  )
}
