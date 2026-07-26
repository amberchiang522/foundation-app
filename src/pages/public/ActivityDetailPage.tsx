import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  Clock,
  Tag,
  Building2,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { activityService } from "@/services"
import { useAuth } from "@/contexts/AuthContext"
import type { Activity, ActivityRegistration } from "@/types"

const statusLabels: Record<Activity["status"], string> = {
  upcoming: "即將開始",
  ongoing: "進行中",
  completed: "已結束",
  archived: "已封存",
}

const statusVariants: Record<Activity["status"], "default" | "secondary" | "outline" | "success"> = {
  upcoming: "default",
  ongoing: "success",
  completed: "secondary",
  archived: "outline",
}

const registrationStatusLabels: Record<ActivityRegistration["status"], string> = {
  confirmed: "已確認報名",
  pending: "待審核",
  waitlist: "候補中",
  cancelled: "已取消",
}

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [registration, setRegistration] = useState<ActivityRegistration | null>(null)
  const [registrationCount, setRegistrationCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    const loadActivity = async () => {
      if (!id) return

      try {
        const [activityData, registrations] = await Promise.all([
          activityService.getActivityById(id),
          activityService.getRegistrationsByActivity(id),
        ])

        setActivity(activityData)
        setRegistrationCount(
          registrations.filter((r) => r.status === "confirmed" || r.status === "pending").length
        )

        // Check if current user is registered
        if (user) {
          const userReg = registrations.find((r) => r.userId === user.id)
          setRegistration(userReg || null)
        }
      } catch (error) {
        console.error("Failed to load activity:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadActivity()
  }, [id, user])

  const handleRegister = async () => {
    if (!activity || !user) return

    setIsRegistering(true)
    try {
      const result = await activityService.registerForActivity(activity.id, user.id)
      if (result) {
        setRegistration(result)
        setRegistrationCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error("Failed to register:", error)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleCancel = async () => {
    if (!activity || !user) return

    setIsCancelling(true)
    try {
      const success = await activityService.cancelRegistration(activity.id, user.id)
      if (success) {
        setRegistration(null)
        setRegistrationCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Failed to cancel:", error)
    } finally {
      setIsCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Hero skeleton */}
        <div className="relative h-[300px] md:h-[400px] bg-muted animate-pulse rounded-2xl" />
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">找不到活動</h1>
        <Button asChild>
          <Link to="/activities">返回活動列表</Link>
        </Button>
      </div>
    )
  }

  const isEnded = activity.status === "completed" || activity.status === "archived"
  const isFull = registrationCount >= activity.capacity
  const remainingSlots = Math.max(0, activity.capacity - registrationCount)
  const canRegister = !isEnded && !registration && isAuthenticated
  const canCancel = registration && registration.status !== "cancelled" && !isEnded

  // Get cover image URL
  const coverUrl =
    activity.coverImage?.originalUrl ||
    "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&h=600&fit=crop"

  return (
    <div className="space-y-8 -mt-6 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Hero Banner */}
      <div className="relative">
        {/* Back Button - Floating */}
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm hover:bg-white shadow-md"
        >
          <Link to="/activities">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Link>
        </Button>

        {/* Cover Image */}
        <div className="relative h-[280px] sm:h-[350px] md:h-[420px] overflow-hidden">
          <img
            src={coverUrl}
            alt={activity.name}
            className="w-full h-full object-cover"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Title & Status on Banner */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
            <div className="container mx-auto">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge
                  variant={statusVariants[activity.status]}
                  className="text-sm px-3 py-1"
                >
                  {statusLabels[activity.status]}
                </Badge>
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  {activity.type}
                </Badge>
                {activity.registrationMode === "approval" && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    需審核
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
                {activity.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card/50">
                <CardContent className="p-4 text-center">
                  <Calendar className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="text-xs text-muted-foreground mb-1">日期</p>
                  <p className="font-semibold text-sm">
                    {format(new Date(activity.date), "MM/dd", { locale: zhTW })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(activity.date), "EEEE", { locale: zhTW })}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardContent className="p-4 text-center">
                  <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="text-xs text-muted-foreground mb-1">時間</p>
                  <p className="font-semibold text-sm">
                    {format(new Date(activity.date), "HH:mm", { locale: zhTW })}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardContent className="p-4 text-center">
                  <MapPin className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="text-xs text-muted-foreground mb-1">地點</p>
                  <p className="font-semibold text-sm line-clamp-2">{activity.location}</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardContent className="p-4 text-center">
                  <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="text-xs text-muted-foreground mb-1">名額</p>
                  <p className="font-semibold text-sm">
                    {registrationCount}/{activity.capacity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isFull ? "已額滿" : `剩 ${remainingSlots} 位`}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  活動說明
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {activity.description || "暫無詳細說明"}
                </p>
              </CardContent>
            </Card>

            {/* Activity Details */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">活動資訊</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">日期時間</p>
                      <p className="font-medium">
                        {format(new Date(activity.date), "yyyy/MM/dd (EEEE)", { locale: zhTW })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(activity.date), "HH:mm 開始", { locale: zhTW })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">活動地點</p>
                      <p className="font-medium">{activity.location}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                      <Tag className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">活動類型</p>
                      <p className="font-medium">{activity.type}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">主辦單位</p>
                      <p className="font-medium">基金會志工團</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content Images Gallery */}
            {activity.contentImages && activity.contentImages.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4">活動相關圖片</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {activity.contentImages.map((img) => (
                      <div key={img.id} className="aspect-video rounded-lg overflow-hidden">
                        <img
                          src={img.originalUrl}
                          alt="活動圖片"
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Registration */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Registration Card */}
              <Card className="border-2">
                <CardContent className="p-6 space-y-6">
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-lg text-center ${
                      isEnded
                        ? "bg-muted"
                        : isFull
                        ? "bg-destructive/10"
                        : "bg-primary/10"
                    }`}
                  >
                    <p
                      className={`text-lg font-semibold ${
                        isEnded
                          ? "text-muted-foreground"
                          : isFull
                          ? "text-destructive"
                          : "text-primary"
                      }`}
                    >
                      {isEnded ? "活動已結束" : isFull ? "名額已滿" : "開放報名中"}
                    </p>
                    {!isEnded && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {isFull ? "可報名候補" : `尚有 ${remainingSlots} 個名額`}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Registration Status or Action */}
                  {registration ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div>
                          <p className="font-medium text-success">
                            {registrationStatusLabels[registration.status]}
                          </p>
                          {registration.waitlistPosition && (
                            <p className="text-sm text-muted-foreground">
                              候補順位：第 {registration.waitlistPosition} 位
                            </p>
                          )}
                        </div>
                      </div>

                      {canCancel && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleCancel}
                          disabled={isCancelling}
                        >
                          {isCancelling ? "取消中..." : "取消報名"}
                        </Button>
                      )}
                    </div>
                  ) : isEnded ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">此活動已結束報名</p>
                    </div>
                  ) : !isAuthenticated ? (
                    <div className="space-y-4">
                      <Button
                        className="w-full h-12 text-base"
                        onClick={() =>
                          navigate("/login", { state: { from: { pathname: `/activities/${id}` } } })
                        }
                      >
                        登入報名
                      </Button>
                      <p className="text-sm text-muted-foreground text-center">
                        還不是志工？
                        <Link to="/apply" className="text-primary hover:underline ml-1">
                          立即申請加入
                        </Link>
                      </p>
                    </div>
                  ) : (
                    <Button
                      className="w-full h-12 text-base"
                      onClick={handleRegister}
                      disabled={isRegistering}
                    >
                      {isRegistering
                        ? "報名中..."
                        : isFull
                        ? "報名候補"
                        : "立即報名"}
                    </Button>
                  )}

                  {/* Notes */}
                  {canRegister && (
                    <div className="space-y-2 text-sm">
                      {isFull && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>此活動已額滿，報名後將進入候補名單</span>
                        </div>
                      )}
                      {activity.registrationMode === "approval" && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>此活動報名需經管理員審核</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Info Summary */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3 text-sm">報名須知</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      請於活動開始前 10 分鐘報到
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      如需取消請提前 24 小時
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      完成活動可獲得服務時數
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
