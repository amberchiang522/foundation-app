import { useState, useEffect } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { projectService, settingsService } from "@/services"
import type { Plan, Project, ProjectType, AdminTag, WorkflowStep } from "@/types"
import {
  Plus,
  Archive,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  DollarSign,
} from "lucide-react"

const statusConfig: Record<
  Project["status"],
  { label: string; variant: "default" | "secondary" | "success" | "destructive" }
> = {
  active: { label: "進行中", variant: "default" },
  completed: { label: "已完成", variant: "success" },
  archived: { label: "已封存", variant: "secondary" },
  not_established: { label: "未立案", variant: "destructive" },
}

const workflowStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" | "outline" }
> = {
  pending: { label: "待處理", variant: "outline" },
  in_progress: { label: "進行中", variant: "warning" },
  approved: { label: "已通過", variant: "success" },
  rejected: { label: "已拒絕", variant: "destructive" },
}

export function ProjectsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const planIdParam = searchParams.get("planId")

  const [projects, setProjects] = useState<Project[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])
  const [adminTags, setAdminTags] = useState<AdminTag[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filter state
  const [planFilter, setPlanFilter] = useState<string>(planIdParam || "all")

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    planId: "",
    name: "",
    description: "",
    projectType: "",
    budgetAmount: 0,
  })
  const [isSaving, setIsSaving] = useState(false)

  // Approval dialog
  const [isApprovalOpen, setIsApprovalOpen] = useState(false)
  const [approvalStep, setApprovalStep] = useState<WorkflowStep | null>(null)
  const [approvalNote, setApprovalNote] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (planIdParam) {
      setPlanFilter(planIdParam)
    }
  }, [planIdParam])

  const loadData = async () => {
    try {
      const [projectsData, plansData, typesData, tagsData] = await Promise.all([
        projectService.getProjects(),
        projectService.getPlans(),
        projectService.getProjectTypes(),
        settingsService.getAdminTags(),
      ])
      setProjects(projectsData)
      setPlans(plansData.filter((p) => p.status === "active"))
      setProjectTypes(typesData)
      setAdminTags(tagsData)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProjects =
    planFilter === "all"
      ? projects
      : projects.filter((p) => p.planId === planFilter)

  const openCreateForm = () => {
    setEditingProject(null)
    setFormData({
      planId: planIdParam || "",
      name: "",
      description: "",
      projectType: "",
      budgetAmount: 0,
    })
    setIsFormOpen(true)
  }

  const openEditForm = (project: Project) => {
    setEditingProject(project)
    setFormData({
      planId: project.planId,
      name: project.name,
      description: project.description,
      projectType: project.projectType,
      budgetAmount: project.budgetAmount,
    })
    setIsFormOpen(true)
  }

  const handleViewDetail = (project: Project) => {
    setSelectedProject(project)
    setIsDetailOpen(true)
  }

  const handleSave = async () => {
    if (!user) return

    if (!formData.name || !formData.planId) {
      alert("請填寫專案名稱並選擇計畫")
      return
    }

    // Validate budget
    const selectedType = projectTypes.find((t) => t.name === formData.projectType)
    if (selectedType) {
      if (
        formData.budgetAmount < selectedType.budgetMin ||
        formData.budgetAmount > selectedType.budgetMax
      ) {
        alert(
          `預算金額需在 ${selectedType.budgetMin.toLocaleString()} ~ ${selectedType.budgetMax.toLocaleString()} 範圍內`
        )
        return
      }
    }

    setIsSaving(true)
    try {
      const plan = plans.find((p) => p.id === formData.planId)
      if (!plan) throw new Error("Plan not found")

      if (editingProject) {
        await projectService.updateProject(editingProject.id, {
          name: formData.name,
          description: formData.description,
          projectType: formData.projectType,
          budgetAmount: formData.budgetAmount,
        })
      } else {
        // Initialize workflow from plan
        const workflow: WorkflowStep[] = plan.workflow.map((step, index) => ({
          ...step,
          status: index === 0 ? "in_progress" : "pending",
        }))

        await projectService.createProject({
          planId: formData.planId,
          name: formData.name,
          description: formData.description,
          projectType: formData.projectType || "一般",
          budgetAmount: formData.budgetAmount,
          workflow,
          currentStep: 0,
          status: "active",
          createdBy: user.id,
        })
      }

      await loadData()
      setIsFormOpen(false)
    } catch (error) {
      console.error("Failed to save project:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async (project: Project) => {
    if (!confirm("確定要封存此專案嗎？")) return

    try {
      await projectService.updateProject(project.id, { status: "archived" })
      await loadData()
      setIsDetailOpen(false)
    } catch (error) {
      console.error("Failed to archive project:", error)
    }
  }

  const openApprovalDialog = (step: WorkflowStep) => {
    setApprovalStep(step)
    setApprovalNote("")
    setIsApprovalOpen(true)
  }

  const handleApproval = async (approved: boolean) => {
    if (!selectedProject || !approvalStep || !user) return

    if (!approved && !approvalNote.trim()) {
      alert("拒絕時請填寫原因")
      return
    }

    setIsProcessing(true)
    try {
      await projectService.advanceWorkflow(
        selectedProject.id,
        approvalStep.id,
        user.id,
        approved,
        approvalNote || undefined
      )

      await loadData()
      // Refresh selected project
      const updated = await projectService.getProjectById(selectedProject.id)
      if (updated) setSelectedProject(updated)

      setIsApprovalOpen(false)
    } catch (error) {
      console.error("Failed to process approval:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setIsProcessing(false)
    }
  }

  const advanceStatus = async (project: Project) => {
    if (!user) return

    const currentStep = project.workflow[project.currentStep]
    if (!currentStep || currentStep.type !== "status") return

    try {
      await projectService.advanceWorkflow(project.id, currentStep.id, user.id, true)
      await loadData()

      // Refresh selected project if viewing
      if (selectedProject?.id === project.id) {
        const updated = await projectService.getProjectById(project.id)
        if (updated) setSelectedProject(updated)
      }
    } catch (error) {
      console.error("Failed to advance status:", error)
    }
  }

  const getPlanName = (planId: string) => {
    return plans.find((p) => p.id === planId)?.name || "未知計畫"
  }

  const canApprove = (step: WorkflowStep) => {
    if (!user || user.role !== "admin") return false
    if (step.type !== "approval") return false

    // Check if user has the required tag
    if (step.approverTagId && user.adminTags) {
      return user.adminTags.includes(step.approverTagId)
    }

    return true
  }

  const getTagName = (tagId: string) => {
    return adminTags.find((t) => t.id === tagId)?.name || tagId
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">專案管理</h1>
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
          <h1 className="text-3xl font-bold">專案管理</h1>
          <p className="text-muted-foreground">管理計畫下的專案與流程進度</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-1" />
          新增專案
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="篩選計畫" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部計畫</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                {planFilter !== "all"
                  ? "此計畫下尚無專案"
                  : "尚無專案，點擊上方按鈕新增"}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredProjects.map((project) => {
            const currentStep = project.workflow[project.currentStep]
            const progress =
              (project.workflow.filter(
                (s) => s.status === "approved"
              ).length /
                project.workflow.length) *
              100

            return (
              <Card
                key={project.id}
                className={project.status === "archived" ? "opacity-60" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline">{getPlanName(project.planId)}</Badge>
                        <Badge variant={statusConfig[project.status].variant}>
                          {statusConfig[project.status].label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || "無描述"}
                  </p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      {project.projectType}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      {project.budgetAmount.toLocaleString()}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">進度</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Current Step */}
                  {currentStep && project.status === "active" && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {currentStep.name}
                          </span>
                        </div>
                        {currentStep.type === "approval" ? (
                          <Badge variant="warning">待審批</Badge>
                        ) : (
                          <Badge variant="outline">狀態</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(project.createdAt), "yyyy/MM/dd")}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetail(project)}
                    >
                      查看詳情
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? "編輯專案" : "新增專案"}</DialogTitle>
            <DialogDescription>填寫專案基本資訊</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>所屬計畫 *</Label>
              <Select
                value={formData.planId}
                onValueChange={(v) => setFormData({ ...formData, planId: v })}
                disabled={!!editingProject}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇計畫" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>專案名稱 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：112年度急難救助"
              />
            </div>

            <div className="space-y-2">
              <Label>專案描述</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="描述專案內容..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>專案類型</Label>
                <Select
                  value={formData.projectType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, projectType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name} ({type.budgetMin.toLocaleString()} ~{" "}
                        {type.budgetMax.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>預算金額</Label>
                <Input
                  type="number"
                  value={formData.budgetAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      budgetAmount: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>
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

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProject?.name}</DialogTitle>
            <DialogDescription>
              {getPlanName(selectedProject?.planId || "")} / {selectedProject?.projectType}
            </DialogDescription>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">狀態</p>
                  <Badge variant={statusConfig[selectedProject.status].variant}>
                    {statusConfig[selectedProject.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">預算金額</p>
                  <p className="font-medium">
                    ${selectedProject.budgetAmount.toLocaleString()}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">描述</p>
                  <p>{selectedProject.description || "無描述"}</p>
                </div>
              </div>

              {/* Workflow */}
              <div className="space-y-4">
                <h3 className="font-semibold">流程進度</h3>
                <div className="space-y-3">
                  {selectedProject.workflow.map((step, index) => {
                    const isCurrentStep = index === selectedProject.currentStep
                    const stepStatus = step.status || "pending"

                    return (
                      <div
                        key={step.id}
                        className={`p-4 rounded-lg border ${
                          isCurrentStep && selectedProject.status === "active"
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium w-6">
                              {index + 1}.
                            </span>
                            <div>
                              <p className="font-medium">{step.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant={step.type === "approval" ? "warning" : "secondary"}
                                >
                                  {step.type === "approval" ? "審批" : "狀態"}
                                </Badge>
                                {step.approverTagId && (
                                  <span className="text-xs text-muted-foreground">
                                    審批人：{getTagName(step.approverTagId)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={workflowStatusConfig[stepStatus]?.variant || "outline"}>
                              {workflowStatusConfig[stepStatus]?.label || stepStatus}
                            </Badge>

                            {/* Action Buttons */}
                            {isCurrentStep &&
                              selectedProject.status === "active" &&
                              stepStatus === "in_progress" && (
                                <>
                                  {step.type === "status" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => advanceStatus(selectedProject)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      完成
                                    </Button>
                                  ) : (
                                    canApprove(step) && (
                                      <Button
                                        size="sm"
                                        onClick={() => openApprovalDialog(step)}
                                      >
                                        審批
                                      </Button>
                                    )
                                  )}
                                </>
                              )}
                          </div>
                        </div>

                        {/* Approval info */}
                        {step.approvedAt && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {step.status === "approved" ? "通過" : "拒絕"}於{" "}
                            {format(new Date(step.approvedAt), "yyyy/MM/dd HH:mm")}
                            {step.note && <span> - {step.note}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  建立時間：{format(new Date(selectedProject.createdAt), "yyyy/MM/dd HH:mm")}
                </div>
                <div className="flex gap-2">
                  {selectedProject.status === "active" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsDetailOpen(false)
                          openEditForm(selectedProject)
                        }}
                      >
                        編輯
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(selectedProject)}
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        封存
                      </Button>
                    </>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={`/dashboard/activities?projectId=${selectedProject.id}`}
                    >
                      查看活動
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalOpen} onOpenChange={setIsApprovalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>審批：{approvalStep?.name}</DialogTitle>
            <DialogDescription>
              專案：{selectedProject?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>備註說明</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="選填，拒絕時必填..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApprovalOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleApproval(false)}
              disabled={isProcessing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              拒絕
            </Button>
            <Button onClick={() => handleApproval(true)} disabled={isProcessing}>
              <CheckCircle className="h-4 w-4 mr-1" />
              通過
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
