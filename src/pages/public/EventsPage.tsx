import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { eventReviewService, projectService } from "@/services"
import type { EventReviewWithDetails, Plan } from "@/types"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  Calendar,
  Image as ImageIcon,
  Loader2,
} from "lucide-react"

export function EventsPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [reviews, setReviews] = useState<EventReviewWithDetails[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterPlanId, setFilterPlanId] = useState<string>("all")

  // Read plan filter from URL on initial load
  useEffect(() => {
    window.scrollTo(0, 0)
    const planId = searchParams.get('plan')
    if (planId) {
      setFilterPlanId(planId)
    }
  }, [searchParams])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [reviewsData, plansData] = await Promise.all([
        eventReviewService.getPublishedReviews(),
        projectService.getPlans(),
      ])
      setReviews(reviewsData)
      setPlans(plansData.filter(p => p.status === 'active'))
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredReviews = filterPlanId === "all"
    ? reviews
    : reviews.filter(r => r.planId === filterPlanId)

  const openReviewDetail = (review: EventReviewWithDetails) => {
    navigate(`/events/${review.id}`)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">活動回顧</h1>
        <p className="text-muted-foreground">
          回顧過往活動精彩時刻
        </p>
      </section>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={filterPlanId} onValueChange={setFilterPlanId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="篩選計畫" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部計畫</SelectItem>
            {plans.map(plan => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>目前沒有活動回顧</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredReviews.map(review => (
            <Card
              key={review.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => openReviewDetail(review)}
            >
              {/* Cover Image */}
              <div className="aspect-video bg-muted relative">
                {review.images && review.images.length > 0 ? (
                  <img
                    src={review.images[0].thumbnailUrl || review.images[0].originalUrl}
                    alt={review.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
                {/* Image Count */}
                {review.images && review.images.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    共 {review.images.length} 張
                  </div>
                )}
                {/* Plan Badge */}
                {review.plan && (
                  <div className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                    {review.plan.name}
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <h3 className="font-semibold mb-1 line-clamp-1">{review.title}</h3>
                {review.eventDate && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(review.eventDate), "yyyy年M月d日", { locale: zhTW })}
                  </p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {review.content || "點擊查看更多照片"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
