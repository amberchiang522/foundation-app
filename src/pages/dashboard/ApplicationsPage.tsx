import { useState, useEffect } from "react"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { userService } from "@/services"
import type { VolunteerApplication } from "@/types"
import { CheckCircle, XCircle, AlertCircle, Eye, Mail, Phone, User } from "lucide-react"

const statusConfig: Record<VolunteerApplication["status"], {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}> = {
  pending: { label: "待審核", variant: "warning" },
  approved: { label: "已通過", variant: "success" },
  rejected: { label: "已拒絕", variant: "destructive" },
  needs_revision: { label: "需補件", variant: "secondary" },
}

export function ApplicationsPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<VolunteerApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog state
  const [selectedApp, setSelectedApp] = useState<VolunteerApplication | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isActionOpen, setIsActionOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject" | "revision">("approve")
  const [actionNote, setActionNote] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    try {
      const data = await userService.getApplications()
      setApplications(data)
    } catch (error) {
      console.error("Failed to load applications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const pendingApps = applications.filter((a) => a.status === "pending")
  const processedApps = applications.filter((a) => a.status !== "pending")

  const handleViewDetail = (app: VolunteerApplication) => {
    setSelectedApp(app)
    setIsDetailOpen(true)
  }

  const openActionDialog = (type: "approve" | "reject" | "revision") => {
    setActionType(type)
    setActionNote("")
    setIsDetailOpen(false)
    setIsActionOpen(true)
  }

  const handleAction = async () => {
    if (!selectedApp || !user) return

    if ((actionType === "reject" || actionType === "revision") && !actionNote.trim()) {
      alert("請填寫備註說明")
      return
    }

    setIsProcessing(true)
    try {
      if (actionType === "approve") {
        await userService.approveApplication(selectedApp.id, user.id)
      } else if (actionType === "reject") {
        await userService.rejectApplication(selectedApp.id, user.id, actionNote)
      } else {
        await userService.requestRevision(selectedApp.id, user.id, actionNote)
      }

      await loadApplications()
      setIsActionOpen(false)
      setSelectedApp(null)
    } catch (error) {
      console.error("Failed to process application:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">志工申請審核</h1>
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
        <h1 className="text-3xl font-bold">志工申請審核</h1>
        <p className="text-muted-foreground">審核志工申請表單</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            待審核 ({pendingApps.length})
          </TabsTrigger>
          <TabsTrigger value="processed">
            已處理 ({processedApps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingApps.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  沒有待審核的申請
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingApps.map((app) => (
                <Card key={app.id} className="relative">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{app.name}</h3>
                        <p className="text-sm text-muted-foreground">{app.email}</p>
                        <p className="text-sm text-muted-foreground">{app.phone}</p>
                      </div>
                      <Badge variant={statusConfig[app.status].variant}>
                        {statusConfig[app.status].label}
                      </Badge>
                    </div>

                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>職業：{app.occupation}</p>
                      <p className="mt-1 line-clamp-2">經驗：{app.experience}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        申請時間：{format(new Date(app.createdAt), "MM/dd HH:mm")}
                      </span>
                      <Button size="sm" onClick={() => handleViewDetail(app)}>
                        <Eye className="h-4 w-4 mr-1" />
                        審核
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="processed" className="mt-4">
          {processedApps.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  沒有已處理的申請
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {processedApps.map((app) => (
                <Card key={app.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{app.name}</h3>
                        <p className="text-sm text-muted-foreground">{app.email}</p>
                      </div>
                      <Badge variant={statusConfig[app.status].variant}>
                        {statusConfig[app.status].label}
                      </Badge>
                    </div>

                    {app.reviewNote && (
                      <div className="mt-3 p-2 bg-muted rounded text-sm">
                        {app.reviewNote}
                      </div>
                    )}

                    <div className="mt-3 text-xs text-muted-foreground">
                      審核時間：{app.reviewedAt && format(new Date(app.reviewedAt), "yyyy/MM/dd HH:mm")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>申請詳情</DialogTitle>
            <DialogDescription>審核此志工申請</DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">姓名</p>
                    <p className="font-medium">{selectedApp.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-sm">{selectedApp.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">電話</p>
                    <p className="font-medium">{selectedApp.phone}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">生日</p>
                  <p className="font-medium">{selectedApp.birthday}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">職業</p>
                  <p className="font-medium">{selectedApp.occupation}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">LINE ID</p>
                  <p className="font-medium">{selectedApp.lineId}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">相關經驗</p>
                <p className="text-sm bg-muted p-3 rounded">{selectedApp.experience}</p>
              </div>

              <div className="text-xs text-muted-foreground">
                申請時間：{format(new Date(selectedApp.createdAt), "yyyy/MM/dd HH:mm", { locale: zhTW })}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
              onClick={() => openActionDialog("revision")}
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              要求補件
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive/10"
              onClick={() => openActionDialog("reject")}
            >
              <XCircle className="h-4 w-4 mr-1" />
              拒絕
            </Button>
            <Button onClick={() => openActionDialog("approve")}>
              <CheckCircle className="h-4 w-4 mr-1" />
              通過
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "確認通過"}
              {actionType === "reject" && "拒絕申請"}
              {actionType === "revision" && "要求補件"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" && `確定要通過 ${selectedApp?.name} 的志工申請嗎？`}
              {actionType === "reject" && "請填寫拒絕理由"}
              {actionType === "revision" && "請說明需要補充的資料"}
            </DialogDescription>
          </DialogHeader>

          {(actionType === "reject" || actionType === "revision") && (
            <div className="space-y-2">
              <Label>
                {actionType === "reject" ? "拒絕理由" : "補件說明"} *
              </Label>
              <textarea
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={
                  actionType === "reject"
                    ? "請說明拒絕原因..."
                    : "請說明需要補充或修改的資料..."
                }
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionOpen(false)}>
              取消
            </Button>
            <Button
              variant={actionType === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={isProcessing}
            >
              {isProcessing ? "處理中..." : "確認"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
