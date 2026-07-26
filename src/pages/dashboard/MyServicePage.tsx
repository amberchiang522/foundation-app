import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Clock, Calendar, TrendingUp, Award } from "lucide-react"

interface ServiceRecord extends ActivityRegistration {
  activity?: Activity
}

export function MyServicePage() {
  const { user } = useAuth()
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadServiceRecords = async () => {
      if (!user) return

      try {
        const registrations = await activityService.getRegistrationsByUser(user.id)

        // Filter only attended activities with service hours
        const attendedRegs = registrations.filter(
          (r) => r.attended && r.serviceHours && r.serviceHours > 0
        )

        // Load activity details
        const regsWithActivities = await Promise.all(
          attendedRegs.map(async (reg) => {
            const activity = await activityService.getActivityById(reg.activityId)
            return { ...reg, activity: activity || undefined }
          })
        )

        // Sort by date descending
        regsWithActivities.sort((a, b) => {
          if (!a.activity || !b.activity) return 0
          return new Date(b.activity.date).getTime() - new Date(a.activity.date).getTime()
        })

        setRecords(regsWithActivities)

        // Calculate total hours
        const total = await activityService.getUserServiceHours(user.id)
        setTotalHours(total)
      } catch (error) {
        console.error("Failed to load service records:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadServiceRecords()
  }, [user])

  // Calculate stats
  const totalActivities = records.length
  const avgHours = totalActivities > 0 ? (totalHours / totalActivities).toFixed(1) : 0

  // Group by month for chart data (simplified)
  const monthlyHours: { [key: string]: number } = {}
  records.forEach((r) => {
    if (r.activity && r.serviceHours) {
      const month = format(new Date(r.activity.date), "yyyy-MM")
      monthlyHours[month] = (monthlyHours[month] || 0) + r.serviceHours
    }
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">服務時數</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">服務時數</h1>
        <p className="text-muted-foreground">您的志工服務紀錄與累計時數</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">累計服務時數</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalHours} 小時</div>
            <p className="text-xs text-muted-foreground mt-1">
              感謝您的付出！
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">參與活動數</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalActivities} 場</div>
            <p className="text-xs text-muted-foreground mt-1">
              已完成的活動
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">平均服務時數</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgHours} 小時</div>
            <p className="text-xs text-muted-foreground mt-1">
              每場活動平均
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Achievement Badge */}
      {totalHours >= 10 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {totalHours >= 100
                    ? "志工達人"
                    : totalHours >= 50
                    ? "熱心志工"
                    : "積極參與者"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {totalHours >= 100
                    ? "累計服務超過 100 小時，感謝您的長期奉獻！"
                    : totalHours >= 50
                    ? "累計服務超過 50 小時，您是團隊的重要力量！"
                    : "累計服務超過 10 小時，繼續加油！"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>服務紀錄明細</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>尚無服務紀錄</p>
              <p className="text-sm mt-2">
                參與活動後，您的服務時數會在這裡顯示
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>活動名稱</TableHead>
                  <TableHead>活動類型</TableHead>
                  <TableHead className="text-right">服務時數</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {record.activity &&
                        format(new Date(record.activity.date), "yyyy/MM/dd", {
                          locale: zhTW,
                        })}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/activities/${record.activityId}`}
                        className="hover:text-primary transition-colors"
                      >
                        {record.activity?.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.activity?.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {record.serviceHours} 小時
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={3} className="font-medium">
                    總計
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {totalHours} 小時
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      {Object.keys(monthlyHours).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>月度統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(monthlyHours)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([month, hours]) => (
                  <div
                    key={month}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="text-sm">
                      {format(new Date(month + "-01"), "yyyy 年 M 月", {
                        locale: zhTW,
                      })}
                    </span>
                    <Badge variant="secondary">{hours} 小時</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
