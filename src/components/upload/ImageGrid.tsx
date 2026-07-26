import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ImagePreview } from './ImagePreview'
import { cn } from '@/lib/utils'
import { type ImageUploadResult } from '@/services/imageService'

interface SortableImageProps {
  image: ImageUploadResult
  onRemove: (id: string) => void
  onSetCover?: (id: string) => void
  coverId?: string
  showCoverButton?: boolean
  aspectRatio?: string
}

function SortableImage({
  image,
  onRemove,
  onSetCover,
  coverId,
  showCoverButton,
  aspectRatio,
}: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'touch-manipulation',
        isDragging && 'z-10 opacity-80'
      )}
    >
      <ImagePreview
        src={image.thumbnailUrl || image.originalUrl}
        fileName={image.fileName}
        onRemove={() => onRemove(image.id)}
        onSetCover={onSetCover ? () => onSetCover(image.id) : undefined}
        isCover={image.id === coverId}
        showCoverButton={showCoverButton}
        isPdf={image.mimeType === 'application/pdf'}
        aspectRatio={aspectRatio}
        className="w-full cursor-grab active:cursor-grabbing"
      />
    </div>
  )
}

interface ImageGridProps {
  images: ImageUploadResult[]
  onImagesChange: (images: ImageUploadResult[]) => void
  onRemove: (id: string) => void
  onSetCover?: (id: string) => void
  coverId?: string
  showCoverButton?: boolean
  aspectRatio?: string
  columns?: 2 | 3 | 4
  className?: string
}

export function ImageGrid({
  images,
  onImagesChange,
  onRemove,
  onSetCover,
  coverId,
  showCoverButton = false,
  aspectRatio,
  columns = 3,
  className,
}: ImageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id)
      const newIndex = images.findIndex((img) => img.id === over.id)

      const newImages = arrayMove(images, oldIndex, newIndex).map(
        (img, index) => ({ ...img, order: index })
      )

      onImagesChange(newImages)
    }
  }

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={images.map((img) => img.id)}
        strategy={rectSortingStrategy}
      >
        <div className={cn('grid gap-4', gridCols[columns], className)}>
          {images.map((image) => (
            <SortableImage
              key={image.id}
              image={image}
              onRemove={onRemove}
              onSetCover={onSetCover}
              coverId={coverId}
              showCoverButton={showCoverButton}
              aspectRatio={aspectRatio}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
