import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { GoogleDriveInput } from "@/components/upload"
import { eventReviewService, projectService } from "@/services"
import type { EventReviewWithDetails, Plan, ImageData } from "@/types"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Calendar,
  Loader2,
} from "lucide-react"

export function EventReviewsPage() {
  const [reviews, setReviews] = useState<EventReviewWithDetails[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<EventReviewWithDetails | null>(null)

  // Filter
  const [filterPlanId, setFilterPlanId] = useState<string>("all")

  // Form data
  const [formData, setFormData] = useState({
    planId: "",
    title: "",
    content: "",
    eventDate: "",
    images: [] as ImageData[],
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [reviewsData, plansData] = await Promise.all([
        eventReviewService.getAllReviews(),
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

  const openCreateForm = () => {
    setEditingReview(null)
    setFormData({
      planId: "",
      title: "",
      content: "",
      eventDate: "",
      images: [],
    })
    setIsFormOpen(true)
  }

  const openEditForm = (review: EventReviewWithDetails) => {
    setEditingReview(review)
    setFormData({
      planId: review.planId,
      title: review.title,
      content: review.content,
      eventDate: review.eventDate || "",
      images: review.images || [],
    })
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!formData.title) return

    setIsSaving(true)
    try {
      if (editingReview) {
        await eventReviewService.updateReview(editingReview.id, {
          title: formData.title,
          content: formData.content,
          eventDate: formData.eventDate || undefined,
          images: formData.images,
        })
      } else {
        await eventReviewService.createReview({
          planId: formData.planId,
          title: formData.title,
          content: formData.content,
          eventDate: formData.eventDate || undefined,
          images: formData.images,
          isPublished: false,
          displayOrder: 0,
          createdBy: "",
        })
      }
      await loadData()
      setIsFormOpen(false)
    } catch (error) {
      console.error("Failed to save review:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此活動回顧？")) return

    try {
      await eventReviewService.deleteReview(id)
      await loadData()
    } catch (error) {
      console.error("Failed to delete review:", error)
    }
  }

  const handleTogglePublish = async (review: EventReviewWithDetails) => {
    try {
      if (review.isPublished) {
        await eventReviewService.unpublishReview(review.id)
      } else {
        await eventReviewService.publishReview(review.id)
      }
      await loadData()
    } catch (error) {
      console.error("Failed to toggle publish:", error)
    }
  }

  const filteredReviews = filterPlanId === "all"
    ? reviews
    : reviews.filter(r => r.planId === filterPlanId)

  // Group reviews by plan
  const groupedReviews = filteredReviews.reduce((acc, review) => {
    const planName = review.plan?.name || "未分類"
    if (!acc[planName]) {
      acc[planName] = []
    }
    acc[planName].push(review)
    return acc
  }, {} as Record<string, EventReviewWithDetails[]>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">活動回顧管理</h1>
          <p className="text-muted-foreground">管理各計畫的活動回顧內容</p>
        </div>
        <Button onClick={openCreateForm} className="gap-2">
          <Plus className="h-4 w-4" />
          新增回顧
        </Button>
      </div>

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
        <span className="text-sm text-muted-foreground">
          共 {filteredReviews.length} 筆回顧
        </span>
      </div>

      {/* Reviews List */}
      {Object.keys(groupedReviews).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>目前沒有活動回顧</p>
            <Button variant="link" onClick={openCreateForm}>
              新增第一篇回顧
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedReviews).map(([planName, planReviews]) => (
            <div key={planName} className="space-y-4">
              <h2 className="text-lg font-semibold text-primary border-l-4 border-primary pl-3">
                {planName}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {planReviews.map(review => (
                  <Card key={review.id} className="overflow-hidden">
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
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2">
                        <Badge variant={review.isPublished ? "default" : "secondary"}>
                          {review.isPublished ? "已發布" : "草稿"}
                        </Badge>
                      </div>
                      {/* Image Count */}
                      {review.images && review.images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          +{review.images.length - 1} 張
                        </div>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1 line-clamp-1">{review.title}</h3>
                      {review.eventDate && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(review.eventDate), "yyyy/MM/dd", { locale: zhTW })}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {review.content || "尚無內容"}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePublish(review)}
                          className="gap-1"
                        >
                          {review.isPublished ? (
                            <>
                              <EyeOff className="h-3 w-3" />
                              取消發布
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" />
                              發布
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditForm(review)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(review.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReview ? "編輯活動回顧" : "新增活動回顧"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Plan Selection */}
            <div className="space-y-2">
              <Label htmlFor="planId">所屬計畫</Label>
              <Select
                value={formData.planId}
                onValueChange={(v) => setFormData({ ...formData, planId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇計畫（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不關聯計畫</SelectItem>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">標題 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="輸入回顧標題"
              />
            </div>

            {/* Event Date */}
            <div className="space-y-2">
              <Label htmlFor="eventDate">活動日期</Label>
              <Input
                id="eventDate"
                type="date"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">內容</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="輸入回顧內容..."
                rows={6}
              />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>照片</Label>
              <GoogleDriveInput
                value={formData.images}
                onChange={(images) => setFormData({ ...formData, images })}
                maxImages={50}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.title || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingReview ? "儲存" : "新增"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
