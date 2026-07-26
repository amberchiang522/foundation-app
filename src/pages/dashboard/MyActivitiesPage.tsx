import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { activityService } from "@/services"
import type { Activity, ActivityRegistration } from "@/types"
import { Calendar, MapPin, ExternalLink } from "lucide-react"

interface RegistrationWithActivity extends ActivityRegistration {
  activity?: Activity
}

const statusLabels: Record<ActivityRegistration["status"], string> = {
  confirmed: "已確認",
  pending: "待審核",
  waitlist: "候補中",
  cancelled: "已取消",
}

const statusVariants: Record<ActivityRegistration["status"], "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  confirmed: "success",
  pending: "warning",
  waitlist: "secondary",
  cancelled: "outline",
}

export function MyActivitiesPage() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState<RegistrationWithActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    const loadRegistrations = async () => {
      if (!user) return

      try {
        const regs = await activityService.getRegistrationsByUser(user.id)

        // Load activity details for each registration
        const regsWithActivities = await Promise.all(
          regs.map(async (reg) => {
            const activity = await activityService.getActivityById(reg.activityId)
            return { ...reg, activity: activity || undefined }
          })
        )

        setRegistrations(regsWithActivities)
      } catch (error) {
        console.error("Failed to load registrations:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRegistrations()
  }, [user])

  const handleCancel = async (reg: RegistrationWithActivity) => {
    if (!user || !reg.activity) return

    if (!confirm("確定要取消報名嗎？")) return

    setCancellingId(reg.id)

    try {
      await activityService.cancelRegistration(reg.activityId, user.id)
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === reg.id ? { ...r, status: "cancelled" } : r
        )
      )
    } catch (error) {
      console.error("Failed to cancel:", error)
      alert("取消失敗，請稍後再試")
    } finally {
      setCancellingId(null)
    }
  }

  const upcomingRegs = registrations.filter(
    (r) => r.activity && (r.activity.status === "upcoming" || r.activity.status === "ongoing")
  )
  const pastRegs = registrations.filter(
    (r) => r.activity && (r.activity.status === "completed" || r.activity.status === "archived")
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">我的報名紀錄</h1>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">載入中...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">我的報名紀錄</h1>
          <p className="text-muted-foreground">查看您報名的活動與狀態</p>
        </div>
        <Button asChild>
          <Link to="/activities">瀏覽活動</Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            即將參加 ({upcomingRegs.filter(r => r.status !== 'cancelled').length})
          </TabsTrigger>
          <TabsTrigger value="past">
            已結束 ({pastRegs.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            全部 ({registrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcomingRegs.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">您尚未報名任何活動</p>
                  <Button asChild>
                    <Link to="/activities">瀏覽活動</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingRegs.map((reg) => (
                <Card key={reg.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        <Link
                          to={`/activities/${reg.activityId}`}
                          className="hover:text-primary transition-colors"
                        >
                          {reg.activity?.name}
                        </Link>
                      </CardTitle>
                      <Badge variant={statusVariants[reg.status]}>
                        {statusLabels[reg.status]}
                        {reg.waitlistPosition && ` #${reg.waitlistPosition}`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {reg.activity &&
                          format(new Date(reg.activity.date), "yyyy/MM/dd (EEE) HH:mm", {
                            locale: zhTW,
                          })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{reg.activity?.location}</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/activities/${reg.activityId}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          查看詳情
                        </Link>
                      </Button>
                      {reg.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleCancel(reg)}
                          disabled={cancellingId === reg.id}
                        >
                          {cancellingId === reg.id ? "取消中..." : "取消報名"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {pastRegs.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  沒有已結束的活動紀錄
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>活動名稱</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>出席</TableHead>
                    <TableHead>服務時數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastRegs.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <Link
                          to={`/activities/${reg.activityId}`}
                          className="hover:text-primary transition-colors"
                        >
                          {reg.activity?.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {reg.activity &&
                          format(new Date(reg.activity.date), "yyyy/MM/dd", {
                            locale: zhTW,
                          })}
                      </TableCell>
                      <TableCell>
                        {reg.attended === undefined ? (
                          <span className="text-muted-foreground">-</span>
                        ) : reg.attended ? (
                          <Badge variant="success">已出席</Badge>
                        ) : (
                          <Badge variant="outline">未出席</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {reg.serviceHours ? `${reg.serviceHours} 小時` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>活動名稱</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>報名時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      沒有報名紀錄
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <Link
                          to={`/activities/${reg.activityId}`}
                          className="hover:text-primary transition-colors"
                        >
                          {reg.activity?.name || "未知活動"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {reg.activity &&
                          format(new Date(reg.activity.date), "yyyy/MM/dd", {
                            locale: zhTW,
                          })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[reg.status]}>
                          {statusLabels[reg.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(reg.createdAt), "yyyy/MM/dd", {
                          locale: zhTW,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
