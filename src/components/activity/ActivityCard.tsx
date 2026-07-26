import { Link } from "react-router-dom"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Calendar, MapPin, Users } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Activity } from "@/types"

interface ActivityCardProps {
  activity: Activity
  registrationCount?: number
}

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

export function ActivityCard({ activity, registrationCount = 0 }: ActivityCardProps) {
  const isFull = registrationCount >= activity.capacity
  const isEnded = activity.status === "completed" || activity.status === "archived"

  // Get cover image URL (thumbnail for list view)
  const coverUrl = activity.coverImage?.thumbnailUrl || activity.coverImage?.originalUrl

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      {/* Cover Image */}
      {coverUrl && (
        <Link to={`/activities/${activity.id}`} className="block">
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={coverUrl}
              alt={activity.name}
              className="w-full h-full object-cover transition-transform hover:scale-105"
            />
          </div>
        </Link>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Link
              to={`/activities/${activity.id}`}
              className="font-semibold hover:text-primary transition-colors line-clamp-2"
            >
              {activity.name}
            </Link>
            <Badge variant={statusVariants[activity.status]}>
              {statusLabels[activity.status]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {activity.description}
        </p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(activity.date), "yyyy/MM/dd (EEEE) HH:mm", { locale: zhTW })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{activity.location}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {registrationCount} / {activity.capacity} 人
              {isFull && !isEnded && (
                <span className="ml-2 text-destructive">(已額滿)</span>
              )}
            </span>
          </div>
        </div>

        <Badge variant="outline">{activity.type}</Badge>
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full" variant={isEnded ? "outline" : "default"}>
          <Link to={`/activities/${activity.id}`}>
            {isEnded ? "查看詳情" : "了解更多"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
