import { useState, useEffect } from "react"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { userService, activityService } from "@/services"
import type { User, Activity, ActivityRegistration } from "@/types"
import { Search, UserX, UserCheck, Eye, Mail, Phone, Calendar, CheckCircle, XCircle, Clock } from "lucide-react"

interface ActivityRecord extends ActivityRegistration {
  activity?: Activity
}

export function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<User[]>([])
  const [filteredVolunteers, setFilteredVolunteers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Detail dialog state
  const [selectedVolunteer, setSelectedVolunteer] = useState<User | null>(null)
  const [volunteerHours, setVolunteerHours] = useState<number>(0)
  const [activityHistory, setActivityHistory] = useState<ActivityRecord[]>([])
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    loadVolunteers()
  }, [])

  const loadVolunteers = async () => {
    try {
      const data = await userService.getUsers()
      setVolunteers(data)
      setFilteredVolunteers(data)
    } catch (error) {
      console.error("Failed to load volunteers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let result = volunteers

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(query) ||
          v.email.toLowerCase().includes(query) ||
          v.volunteerNumber.toLowerCase().includes(query) ||
          v.phone.includes(query)
      )
    }

    if (typeFilter !== "all") {
      result = result.filter((v) => v.type === typeFilter)
    }

    if (statusFilter !== "all") {
      result = result.filter((v) => v.status === statusFilter)
    }

    setFilteredVolunteers(result)
  }, [volunteers, searchQuery, typeFilter, statusFilter])

  const handleViewDetail = async (volunteer: User) => {
    setSelectedVolunteer(volunteer)
    setIsDetailOpen(true)
    setIsLoadingHistory(true)

    try {
      // Load service hours
      const hours = await activityService.getUserServiceHours(volunteer.id)
      setVolunteerHours(hours)

      // Load activity history
      const registrations = await activityService.getRegistrationsByUser(volunteer.id)

      // Load activity details for each registration
      const historyWithActivities = await Promise.all(
        registrations.map(async (reg) => {
          const activity = await activityService.getActivityById(reg.activityId)
          return { ...reg, activity: activity || undefined }
        })
      )

      // Sort by date descending
      historyWithActivities.sort((a, b) => {
        if (!a.activity || !b.activity) return 0
        return new Date(b.activity.date).getTime() - new Date(a.activity.date).getTime()
      })

      setActivityHistory(historyWithActivities)
    } catch (error) {
      console.error("Failed to load volunteer details:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!selectedVolunteer) return

    setIsProcessing(true)
    try {
      const newStatus = selectedVolunteer.status === "active" ? "suspended" : "active"
      if (newStatus === "suspended") {
        await userService.suspendUser(selectedVolunteer.id)
      } else {
        await userService.activateUser(selectedVolunteer.id)
      }

      setVolunteers((prev) =>
        prev.map((v) =>
          v.id === selectedVolunteer.id ? { ...v, status: newStatus } : v
        )
      )
      setSelectedVolunteer((prev) =>
        prev ? { ...prev, status: newStatus } : null
      )
    } catch (error) {
      console.error("Failed to update status:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">志工管理</h1>
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
        <h1 className="text-3xl font-bold">志工管理</h1>
        <p className="text-muted-foreground">管理所有審核通過的志工</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋姓名、Email、編號、電話..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="志工類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            <SelectItem value="youth">青年志工</SelectItem>
            <SelectItem value="social">社會志工</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="active">正常</SelectItem>
            <SelectItem value="suspended">已停權</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">總人數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{volunteers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">青年志工</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {volunteers.filter((v) => v.type === "youth").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">社會志工</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {volunteers.filter((v) => v.type === "social").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>編號</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">類型</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVolunteers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  沒有符合條件的志工
                </TableCell>
              </TableRow>
            ) : (
              filteredVolunteers.map((volunteer) => (
                <TableRow key={volunteer.id}>
                  <TableCell className="font-mono">{volunteer.volunteerNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {volunteer.avatar ? (
                        <img
                          src={volunteer.avatar.thumbnailUrl || volunteer.avatar.originalUrl}
                          alt={volunteer.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {volunteer.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="font-medium">{volunteer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {volunteer.email}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={volunteer.type === "youth" ? "default" : "secondary"}>
                      {volunteer.type === "youth" ? "青年" : "社會"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={volunteer.status === "active" ? "success" : "destructive"}>
                      {volunteer.status === "active" ? "正常" : "停權"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetail(volunteer)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>志工詳情</DialogTitle>
            <DialogDescription>
              {selectedVolunteer?.volunteerNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedVolunteer && (
            <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">基本資料</TabsTrigger>
                <TabsTrigger value="history">活動紀錄</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex-1 overflow-auto">
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-4">
                    {selectedVolunteer.avatar ? (
                      <img
                        src={selectedVolunteer.avatar.thumbnailUrl || selectedVolunteer.avatar.originalUrl}
                        alt={selectedVolunteer.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">
                          {selectedVolunteer.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold">{selectedVolunteer.name}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={selectedVolunteer.type === "youth" ? "default" : "secondary"}>
                          {selectedVolunteer.type === "youth" ? "青年志工" : "社會志工"}
                        </Badge>
                        <Badge variant={selectedVolunteer.status === "active" ? "success" : "destructive"}>
                          {selectedVolunteer.status === "active" ? "正常" : "已停權"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedVolunteer.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedVolunteer.phone}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">生日</p>
                      <p className="font-medium">
                        {format(new Date(selectedVolunteer.birthday), "yyyy/MM/dd")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">職業</p>
                      <p className="font-medium">{selectedVolunteer.occupation}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">LINE ID</p>
                      <p className="font-medium">{selectedVolunteer.lineId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">服務時數</p>
                      <p className="font-medium">{volunteerHours} 小時</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">經驗描述</p>
                    <p className="text-sm">{selectedVolunteer.experience}</p>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    加入時間：{format(new Date(selectedVolunteer.createdAt), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-hidden">
                <ScrollArea className="h-[400px] py-4">
                  {isLoadingHistory ? (
                    <div className="text-center text-muted-foreground py-8">
                      載入中...
                    </div>
                  ) : activityHistory.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      尚無活動紀錄
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {activityHistory.map((record) => (
                        <div
                          key={record.id}
                          className="p-4 border rounded-lg space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{record.activity?.name}</p>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {record.activity &&
                                  format(new Date(record.activity.date), "yyyy/MM/dd", {
                                    locale: zhTW,
                                  })}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {record.status === "confirmed" && record.attended !== undefined && (
                                <Badge variant={record.attended ? "success" : "destructive"}>
                                  {record.attended ? (
                                    <><CheckCircle className="h-3 w-3 mr-1" />已出席</>
                                  ) : (
                                    <><XCircle className="h-3 w-3 mr-1" />未出席</>
                                  )}
                                </Badge>
                              )}
                              {record.status === "cancelled" && (
                                <Badge variant="secondary">已取消</Badge>
                              )}
                              {record.status === "pending" && (
                                <Badge variant="warning">待審核</Badge>
                              )}
                              {record.status === "waitlist" && (
                                <Badge variant="outline">候補中</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            <Badge variant="outline">{record.activity?.type}</Badge>
                            {record.attended && record.serviceHours && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {record.serviceHours} 小時
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant={selectedVolunteer?.status === "active" ? "destructive" : "default"}
              onClick={handleToggleStatus}
              disabled={isProcessing}
            >
              {isProcessing ? (
                "處理中..."
              ) : selectedVolunteer?.status === "active" ? (
                <>
                  <UserX className="h-4 w-4 mr-1" />
                  停權
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-1" />
                  恢復
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
