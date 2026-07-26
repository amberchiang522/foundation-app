import { useState, useEffect } from "react"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { ImageUploader, MultiImageUploader } from "@/components/upload"
import { useAuth } from "@/contexts/AuthContext"
import { activityService, userService, type ImageUploadResult } from "@/services"
import type { Activity, ActivityRegistration, User, ImageData } from "@/types"
import { Plus, Edit, Users, Archive, Calendar, MapPin, Clock, Tag, Eye } from "lucide-react"

const statusLabels: Record<Activity["status"], string> = {
  upcoming: "即將開始",
  ongoing: "進行中",
  completed: "已結束",
  archived: "已封存",
}

export function ActivitiesManagePage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isRegistrationsOpen, setIsRegistrationsOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [registrations, setRegistrations] = useState<(ActivityRegistration & { user?: User })[]>([])
  const [selectedActivityRegCount, setSelectedActivityRegCount] = useState(0)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: "",
    location: "",
    type: "",
    capacity: "",
    registrationMode: "direct" as "direct" | "approval",
  })
  const [coverImage, setCoverImage] = useState<ImageUploadResult | null>(null)
  const [contentImages, setContentImages] = useState<ImageUploadResult[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadActivities()
  }, [])

  const loadActivities = async () => {
    try {
      const data = await activityService.getActivities()
      setActivities(data)
    } catch (error) {
      console.error("Failed to load activities:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const openCreateForm = () => {
    setEditingActivity(null)
    setFormData({
      name: "",
      description: "",
      date: "",
      location: "",
      type: "",
      capacity: "",
      registrationMode: "direct",
    })
    setCoverImage(null)
    setContentImages([])
    setIsFormOpen(true)
  }

  const openEditForm = (activity: Activity) => {
    setEditingActivity(activity)
    setFormData({
      name: activity.name,
      description: activity.description,
      date: activity.date.slice(0, 16), // Format for datetime-local
      location: activity.location,
      type: activity.type,
      capacity: String(activity.capacity),
      registrationMode: activity.registrationMode,
    })
    // Load existing images
    setCoverImage(activity.coverImage as ImageUploadResult | null || null)
    setContentImages((activity.contentImages || []) as ImageUploadResult[])
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!user) return

    if (!formData.name || !formData.date || !formData.location || !formData.capacity) {
      alert("請填寫必要欄位")
      return
    }

    setIsSaving(true)
    try {
      const data = {
        name: formData.name,
        description: formData.description,
        date: new Date(formData.date).toISOString(),
        location: formData.location,
        type: formData.type || "一般",
        capacity: parseInt(formData.capacity),
        registrationMode: formData.registrationMode,
        coverImage: coverImage as ImageData | undefined,
        contentImages: contentImages as ImageData[],
        status: "upcoming" as const,
        createdBy: user.id,
      }

      if (editingActivity) {
        await activityService.updateActivity(editingActivity.id, data)
      } else {
        await activityService.createActivity(data)
      }

      await loadActivities()
      setIsFormOpen(false)
    } catch (error) {
      console.error("Failed to save activity:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async (activity: Activity) => {
    if (!confirm("確定要封存此活動嗎？")) return

    try {
      await activityService.archiveActivity(activity.id)
      await loadActivities()
    } catch (error) {
      console.error("Failed to archive activity:", error)
    }
  }

  const openActivityDetail = async (activity: Activity) => {
    setSelectedActivity(activity)
    const regs = await activityService.getRegistrationsByActivity(activity.id)
    setSelectedActivityRegCount(
      regs.filter((r) => r.status === "confirmed" || r.status === "pending").length
    )
    setIsDetailOpen(true)
  }

  const handleEditFromDetail = () => {
    if (selectedActivity) {
      setIsDetailOpen(false)
      openEditForm(selectedActivity)
    }
  }

  const openRegistrations = async (activity: Activity) => {
    setSelectedActivity(activity)
    const regs = await activityService.getRegistrationsByActivity(activity.id)

    // Load user details for each registration
    const regsWithUsers = await Promise.all(
      regs.map(async (reg) => {
        const userData = await userService.getUserById(reg.userId)
        return { ...reg, user: userData || undefined }
      })
    )

    setRegistrations(regsWithUsers)
    setIsRegistrationsOpen(true)
  }

  const handleApproveRegistration = async (regId: string) => {
    if (!user) return

    try {
      await activityService.approveRegistration(regId, user.id)
      if (selectedActivity) {
        await openRegistrations(selectedActivity)
      }
    } catch (error) {
      console.error("Failed to approve:", error)
    }
  }

  const upcomingActivities = activities.filter(
    (a) => a.status === "upcoming" || a.status === "ongoing"
  )
  const pastActivities = activities.filter(
    (a) => a.status === "completed" || a.status === "archived"
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">活動管理</h1>
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
          <h1 className="text-3xl font-bold">活動管理</h1>
          <p className="text-muted-foreground">管理志工活動與報名</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-1" />
          新增活動
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">進行中 ({upcomingActivities.length})</TabsTrigger>
          <TabsTrigger value="past">已結束 ({pastActivities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>活動名稱</TableHead>
                  <TableHead className="hidden md:table-cell">日期</TableHead>
                  <TableHead className="hidden sm:table-cell">報名</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      沒有進行中的活動
                    </TableCell>
                  </TableRow>
                ) : (
                  upcomingActivities.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openActivityDetail(activity)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {activity.coverImage && (
                            <img
                              src={activity.coverImage.thumbnailUrl || activity.coverImage.originalUrl}
                              alt=""
                              className="w-12 h-9 rounded object-cover hidden sm:block"
                            />
                          )}
                          <div>
                            <p className="font-medium">{activity.name}</p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {format(new Date(activity.date), "MM/dd HH:mm")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(activity.date), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        0 / {activity.capacity}
                      </TableCell>
                      <TableCell>
                        <Badge variant={activity.status === "upcoming" ? "default" : "success"}>
                          {statusLabels[activity.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openRegistrations(activity)
                            }}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditForm(activity)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchive(activity)
                            }}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>活動名稱</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      沒有已結束的活動
                    </TableCell>
                  </TableRow>
                ) : (
                  pastActivities.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openActivityDetail(activity)}
                    >
                      <TableCell className="font-medium">{activity.name}</TableCell>
                      <TableCell>
                        {format(new Date(activity.date), "yyyy/MM/dd")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{statusLabels[activity.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openRegistrations(activity)
                          }}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Activity Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingActivity ? "編輯活動" : "新增活動"}</DialogTitle>
            <DialogDescription>填寫活動資訊</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>活動名稱 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：社區清潔日"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>日期時間 *</Label>
                <Input
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>需求人數 *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>地點 *</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="例如：中正公園"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>活動類型</Label>
                <Input
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="例如：社區服務"
                />
              </div>
              <div className="space-y-2">
                <Label>報名方式</Label>
                <Select
                  value={formData.registrationMode}
                  onValueChange={(v) =>
                    setFormData({ ...formData, registrationMode: v as "direct" | "approval" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">報名即確認</SelectItem>
                    <SelectItem value="approval">需審核</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>活動說明</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="描述活動內容..."
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label>活動封面圖 *</Label>
              <p className="text-xs text-muted-foreground">建議比例 4:3，檔案大小 2MB 以內</p>
              <ImageUploader
                type="activity-cover"
                value={coverImage}
                onChange={setCoverImage}
              />
            </div>

            {/* Content Images */}
            <div className="space-y-2">
              <Label>活動圖片</Label>
              <p className="text-xs text-muted-foreground">可上傳多張，建議比例 16:9</p>
              <MultiImageUploader
                type="activity-content"
                value={contentImages}
                onChange={setContentImages}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrations Dialog */}
      <Dialog open={isRegistrationsOpen} onOpenChange={setIsRegistrationsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>報名名單</DialogTitle>
            <DialogDescription>
              {selectedActivity?.name} - {registrations.length} 人報名
            </DialogDescription>
          </DialogHeader>

          {selectedActivity && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(selectedActivity.date), "yyyy/MM/dd HH:mm")}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {selectedActivity.location}
                </div>
              </div>

              {registrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  尚無人報名
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>聯絡方式</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{reg.user?.name || "未知"}</p>
                            <p className="text-xs text-muted-foreground">
                              {reg.user?.volunteerNumber}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {reg.user?.phone}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              reg.status === "confirmed"
                                ? "success"
                                : reg.status === "pending"
                                ? "warning"
                                : reg.status === "waitlist"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {reg.status === "confirmed" && "已確認"}
                            {reg.status === "pending" && "待審核"}
                            {reg.status === "waitlist" && `候補 #${reg.waitlistPosition}`}
                            {reg.status === "cancelled" && "已取消"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {reg.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveRegistration(reg.id)}
                            >
                              核准
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>活動詳情</DialogTitle>
          </DialogHeader>

          {selectedActivity && (
            <div className="space-y-6">
              {/* Cover Image */}
              {selectedActivity.coverImage && (
                <div className="aspect-video rounded-lg overflow-hidden">
                  <img
                    src={selectedActivity.coverImage.originalUrl}
                    alt={selectedActivity.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title & Status */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedActivity.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={
                        selectedActivity.status === "upcoming"
                          ? "default"
                          : selectedActivity.status === "ongoing"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {statusLabels[selectedActivity.status]}
                    </Badge>
                    <Badge variant="outline">{selectedActivity.type}</Badge>
                  </div>
                </div>
                <Button onClick={handleEditFromDetail}>
                  <Edit className="h-4 w-4 mr-1" />
                  編輯活動
                </Button>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">日期時間</p>
                    <p className="font-medium">
                      {format(new Date(selectedActivity.date), "yyyy/MM/dd HH:mm", {
                        locale: zhTW,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">地點</p>
                    <p className="font-medium">{selectedActivity.location}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">報名人數</p>
                    <p className="font-medium">
                      {selectedActivityRegCount} / {selectedActivity.capacity} 人
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">報名方式</p>
                    <p className="font-medium">
                      {selectedActivity.registrationMode === "direct" ? "報名即確認" : "需審核"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedActivity.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">活動說明</p>
                  <p className="whitespace-pre-wrap">{selectedActivity.description}</p>
                </div>
              )}

              {/* Content Images */}
              {selectedActivity.contentImages && selectedActivity.contentImages.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">活動圖片</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedActivity.contentImages.map((img) => (
                      <div key={img.id} className="aspect-video rounded overflow-hidden">
                        <img
                          src={img.thumbnailUrl || img.originalUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailOpen(false)
                    openRegistrations(selectedActivity)
                  }}
                >
                  <Users className="h-4 w-4 mr-1" />
                  查看報名
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailOpen(false)
                    handleArchive(selectedActivity)
                  }}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  封存
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
