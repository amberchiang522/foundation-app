import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { userService, activityService, projectService } from "@/services"
import {
  Users,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  FolderKanban
} from "lucide-react"

interface Stats {
  volunteers: {
    total: number
    youth: number
    social: number
    pending: number
  }
  activities: {
    total: number
    upcoming: number
    completed: number
  }
  projects: {
    totalPlans: number
    activePlans: number
    totalProjects: number
    activeProjects: number
  }
  myServiceHours?: number
}

export function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [volunteerStats, activityStats, projectStats] = await Promise.all([
          userService.getStats(),
          activityService.getStats(),
          projectService.getStats(),
        ])

        let myServiceHours: number | undefined
        if (user) {
          myServiceHours = await activityService.getUserServiceHours(user.id)
        }

        setStats({
          volunteers: {
            total: volunteerStats.totalVolunteers,
            youth: volunteerStats.youthCount,
            social: volunteerStats.socialCount,
            pending: volunteerStats.pendingApplications,
          },
          activities: {
            total: activityStats.totalActivities,
            upcoming: activityStats.upcomingCount,
            completed: activityStats.completedCount,
          },
          projects: projectStats,
          myServiceHours,
        })
      } catch (error) {
        console.error("Failed to load stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [user])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">儀表板</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">儀表板</h1>
          <p className="text-muted-foreground">
            歡迎回來，{user?.name}
          </p>
        </div>
      </div>

      {/* Admin Dashboard */}
      {isAdmin ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* 志工 Card */}
            <Link to="/dashboard/volunteers">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    志工
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">{stats?.volunteers.total || 0} 人</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      青年 {stats?.volunteers.youth || 0} / 社會 {stats?.volunteers.social || 0}
                    </p>
                  </div>
                  <div className="text-sm">
                    {(stats?.volunteers.pending || 0) > 0 ? (
                      <span className="text-orange-600 font-medium">{stats?.volunteers.pending} 筆待審核</span>
                    ) : (
                      <span className="text-muted-foreground">無待審核申請</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 活動 Card */}
            <Link to="/dashboard/activities">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    活動
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">{stats?.activities.total || 0} 場</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      進行中 {stats?.activities.upcoming || 0} / 已結束 {stats?.activities.completed || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 計畫個案 Card */}
            <Link to="/dashboard/plans">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderKanban className="h-5 w-5" />
                    計畫個案
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">{stats?.projects.activeProjects || 0} 個案</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      進行中 · {stats?.projects.activePlans || 0} 個計畫
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* Volunteer View */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">我的服務時數</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.myServiceHours || 0} 小時</div>
                <Link
                  to="/dashboard/my-service"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  查看詳情 <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">即將舉辦活動</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activities.upcoming || 0}</div>
                <Link
                  to="/activities"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  瀏覽活動 <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">志工編號</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{user?.volunteerNumber}</div>
                <p className="text-xs text-muted-foreground">
                  {user?.type === 'youth' ? '青年志工' : '社會志工'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions for Volunteer */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">我的報名</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  查看您報名的活動與狀態
                </p>
                <Button asChild size="sm">
                  <Link to="/dashboard/my-activities">查看報名紀錄</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">個人資料</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  更新您的聯絡資訊
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/dashboard/profile">編輯資料</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
