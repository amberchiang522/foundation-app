import { useState, useEffect } from "react"
import { format } from "date-fns"
import Papa from "papaparse"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { userService, activityService, projectService } from "@/services"
import type { User, Activity, Project, ActivityRegistration, Plan } from "@/types"
import {
  Users,
  Calendar,
  FolderKanban,
  Clock,
  Download,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle,
} from "lucide-react"

interface Stats {
  totalVolunteers: number
  youthVolunteers: number
  socialVolunteers: number
  totalActivities: number
  completedActivities: number
  upcomingActivities: number
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalServiceHours: number
  totalBudget: number
}

export function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [volunteers, setVolunteers] = useState<User[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [registrations, setRegistrations] = useState<ActivityRegistration[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filter states
  const [volunteerFilter, setVolunteerFilter] = useState<string>("all")
  const [activityFilter, setActivityFilter] = useState<string>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [volunteersData, activitiesData, projectsData, plansData] = await Promise.all([
        userService.getUsers(),
        activityService.getActivities(),
        projectService.getProjects(),
        projectService.getPlans(),
      ])

      setVolunteers(volunteersData)
      setActivities(activitiesData)
      setProjects(projectsData)
      setPlans(plansData)

      // Load all registrations for service hours calculation
      const allRegs: ActivityRegistration[] = []
      for (const activity of activitiesData) {
        const regs = await activityService.getRegistrationsByActivity(activity.id)
        allRegs.push(...regs)
      }
      setRegistrations(allRegs)

      // Calculate stats
      const totalServiceHours = allRegs.reduce(
        (sum, r) => sum + (r.attended && r.serviceHours ? r.serviceHours : 0),
        0
      )

      const totalBudget = projectsData.reduce((sum, p) => sum + p.budgetAmount, 0)

      setStats({
        totalVolunteers: volunteersData.length,
        youthVolunteers: volunteersData.filter((v) => v.type === "youth").length,
        socialVolunteers: volunteersData.filter((v) => v.type === "social").length,
        totalActivities: activitiesData.length,
        completedActivities: activitiesData.filter((a) => a.status === "completed").length,
        upcomingActivities: activitiesData.filter((a) => a.status === "upcoming").length,
        totalProjects: projectsData.length,
        activeProjects: projectsData.filter((p) => p.status === "active").length,
        completedProjects: projectsData.filter((p) => p.status === "completed").length,
        totalServiceHours,
        totalBudget,
      })
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadCSV = (data: object[], filename: string) => {
    const csv = Papa.unparse(data)
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${format(new Date(), "yyyyMMdd")}.csv`
    link.click()
  }

  const exportVolunteers = () => {
    let data = volunteers

    if (volunteerFilter === "youth") {
      data = data.filter((v) => v.type === "youth")
    } else if (volunteerFilter === "social") {
      data = data.filter((v) => v.type === "social")
    } else if (volunteerFilter === "active") {
      data = data.filter((v) => v.status === "active")
    } else if (volunteerFilter === "suspended") {
      data = data.filter((v) => v.status === "suspended")
    }

    const exportData = data.map((v) => ({
      志工編號: v.volunteerNumber,
      姓名: v.name,
      類型: v.type === "youth" ? "青年志工" : "社會志工",
      狀態: v.status === "active" ? "正常" : "已停權",
      Email: v.email,
      電話: v.phone,
      生日: v.birthday,
      職業: v.occupation,
      "LINE ID": v.lineId,
      加入時間: format(new Date(v.createdAt), "yyyy/MM/dd"),
    }))

    downloadCSV(exportData, "志工名冊")
  }

  const exportActivities = () => {
    let data = activities

    if (activityFilter === "upcoming") {
      data = data.filter((a) => a.status === "upcoming")
    } else if (activityFilter === "completed") {
      data = data.filter((a) => a.status === "completed")
    }

    const exportData = data.map((a) => {
      const activityRegs = registrations.filter((r) => r.activityId === a.id)
      const confirmedCount = activityRegs.filter((r) => r.status === "confirmed").length
      const attendedCount = activityRegs.filter((r) => r.attended).length
      const totalHours = activityRegs.reduce(
        (sum, r) => sum + (r.attended && r.serviceHours ? r.serviceHours : 0),
        0
      )

      return {
        活動名稱: a.name,
        類型: a.type,
        日期: format(new Date(a.date), "yyyy/MM/dd"),
        地點: a.location,
        狀態: a.status === "upcoming" ? "即將舉行" : a.status === "completed" ? "已完成" : a.status,
        需求人數: a.capacity,
        報名人數: confirmedCount,
        實際出席: attendedCount,
        總服務時數: totalHours,
        報名模式: a.registrationMode === "direct" ? "直接確認" : "需審核",
      }
    })

    downloadCSV(exportData, "活動紀錄")
  }

  const exportProjects = () => {
    let data = projects

    if (projectFilter === "active") {
      data = data.filter((p) => p.status === "active")
    } else if (projectFilter === "completed") {
      data = data.filter((p) => p.status === "completed")
    }

    const exportData = data.map((p) => {
      const plan = plans.find((pl) => pl.id === p.planId)
      const progress = (p.workflow.filter((s) => s.status === "approved").length / p.workflow.length) * 100

      return {
        專案名稱: p.name,
        所屬計畫: plan?.name || "",
        專案類型: p.projectType,
        預算金額: p.budgetAmount,
        狀態: p.status === "active" ? "進行中" : p.status === "completed" ? "已完成" : "已封存",
        進度百分比: `${Math.round(progress)}%`,
        當前步驟: p.workflow[p.currentStep]?.name || "",
        建立時間: format(new Date(p.createdAt), "yyyy/MM/dd"),
      }
    })

    downloadCSV(exportData, "專案撥款統計")
  }

  const exportServiceHours = () => {
    // Group registrations by user
    const userHours: { [userId: string]: { user: User | undefined; hours: number; count: number } } = {}

    registrations
      .filter((r) => r.attended && r.serviceHours)
      .forEach((r) => {
        if (!userHours[r.userId]) {
          userHours[r.userId] = {
            user: volunteers.find((v) => v.id === r.userId),
            hours: 0,
            count: 0,
          }
        }
        userHours[r.userId].hours += r.serviceHours || 0
        userHours[r.userId].count += 1
      })

    const exportData = Object.values(userHours)
      .filter((item) => item.user)
      .map((item) => ({
        志工編號: item.user!.volunteerNumber,
        姓名: item.user!.name,
        類型: item.user!.type === "youth" ? "青年志工" : "社會志工",
        累計服務時數: item.hours,
        參與活動數: item.count,
        平均每場時數: item.count > 0 ? (item.hours / item.count).toFixed(1) : 0,
      }))
      .sort((a, b) => b.累計服務時數 - a.累計服務時數)

    downloadCSV(exportData, "服務時數統計")
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">報表中心</h1>
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
      <div>
        <h1 className="text-3xl font-bold">報表中心</h1>
        <p className="text-muted-foreground">查看統計數據與匯出報表</p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">志工總數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalVolunteers}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="default">青年 {stats?.youthVolunteers}</Badge>
              <Badge variant="secondary">社會 {stats?.socialVolunteers}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">活動總數</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalActivities}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="success">已完成 {stats?.completedActivities}</Badge>
              <Badge variant="outline">即將 {stats?.upcomingActivities}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">專案統計</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProjects}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="default">進行中 {stats?.activeProjects}</Badge>
              <Badge variant="success">完成 {stats?.completedProjects}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">總服務時數</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalServiceHours} 小時</div>
            <p className="text-xs text-muted-foreground mt-1">
              總撥款 ${stats?.totalBudget.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Volunteer Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>志工名冊</CardTitle>
            </div>
            <CardDescription>匯出志工資料為 CSV 檔案</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={volunteerFilter} onValueChange={setVolunteerFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="篩選條件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部志工</SelectItem>
                  <SelectItem value="youth">青年志工</SelectItem>
                  <SelectItem value="social">社會志工</SelectItem>
                  <SelectItem value="active">正常狀態</SelectItem>
                  <SelectItem value="suspended">已停權</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportVolunteers}>
                <Download className="h-4 w-4 mr-2" />
                匯出 CSV
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              包含：志工編號、姓名、類型、聯絡資訊、加入時間
            </p>
          </CardContent>
        </Card>

        {/* Activity Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>活動參與紀錄</CardTitle>
            </div>
            <CardDescription>匯出活動統計資料</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="篩選條件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部活動</SelectItem>
                  <SelectItem value="upcoming">即將舉行</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportActivities}>
                <Download className="h-4 w-4 mr-2" />
                匯出 CSV
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              包含：活動資訊、報名人數、出席人數、服務時數
            </p>
          </CardContent>
        </Card>

        {/* Project Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              <CardTitle>專案撥款統計</CardTitle>
            </div>
            <CardDescription>匯出專案與預算資料</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="篩選條件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部專案</SelectItem>
                  <SelectItem value="active">進行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportProjects}>
                <Download className="h-4 w-4 mr-2" />
                匯出 CSV
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              包含：專案資訊、預算金額、流程進度
            </p>
          </CardContent>
        </Card>

        {/* Service Hours Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>服務時數統計</CardTitle>
            </div>
            <CardDescription>匯出志工服務時數明細</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button onClick={exportServiceHours}>
                <Download className="h-4 w-4 mr-2" />
                匯出 CSV
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              包含：志工姓名、累計時數、參與活動數、平均時數
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>統計摘要</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">志工出勤率</p>
                <p className="text-lg font-semibold">
                  {registrations.length > 0
                    ? Math.round(
                        (registrations.filter((r) => r.attended).length /
                          registrations.filter((r) => r.status === "confirmed").length) *
                          100
                      ) || 0
                    : 0}
                  %
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">平均每活動人數</p>
                <p className="text-lg font-semibold">
                  {stats?.totalActivities
                    ? Math.round(
                        registrations.filter((r) => r.status === "confirmed").length /
                          stats.totalActivities
                      )
                    : 0}{" "}
                  人
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">平均每人時數</p>
                <p className="text-lg font-semibold">
                  {stats?.totalVolunteers
                    ? ((stats?.totalServiceHours || 0) / stats.totalVolunteers).toFixed(1)
                    : 0}{" "}
                  小時
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FolderKanban className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">平均專案預算</p>
                <p className="text-lg font-semibold">
                  $
                  {stats?.totalProjects
                    ? Math.round((stats?.totalBudget || 0) / stats.totalProjects).toLocaleString()
                    : 0}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
