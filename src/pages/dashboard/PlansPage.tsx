import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
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
import { MultiImageUploader } from "@/components/upload"
import { useAuth } from "@/contexts/AuthContext"
import { projectService, settingsService, type ImageUploadResult } from "@/services"
import type { Plan, Project, WorkflowStep, WorkflowTemplate, AdminTag, ProjectType, SubTask, ImageData } from "@/types"
import {
  Plus,
  Archive,
  CheckCircle,
  XCircle,
  Trash2,
  ArrowLeft,
  Play,
  ListChecks,
  Paperclip,
  Eye,
  Filter,
  ArrowUpDown,
  AlertCircle,
  MessageSquare,
  Image as ImageIcon,
} from "lucide-react"

export function PlansPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [adminTags, setAdminTags] = useState<AdminTag[]>([])
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Navigation state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Dialog states
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [viewingTemplateWorkflow, setViewingTemplateWorkflow] = useState<WorkflowStep[] | null>(null)

  // Plan form state
  const [planFormData, setPlanFormData] = useState({
    name: "",
    description: "",
    type: "",
  })
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [isSavingPlan, setIsSavingPlan] = useState(false)

  // Project form state
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
    projectType: "",
    budgetAmount: 0,
  })
  const [isSavingProject, setIsSavingProject] = useState(false)

  // Approval dialog
  const [isApprovalOpen, setIsApprovalOpen] = useState(false)
  const [approvalStep, setApprovalStep] = useState<WorkflowStep | null>(null)
  const [approvalNote, setApprovalNote] = useState("")
  const [approvalAttachments, setApprovalAttachments] = useState<ImageUploadResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Sub-tasks inline input (per step)
  const [subTaskInputs, setSubTaskInputs] = useState<Record<number, string>>({})
  const [subTaskAttachmentReq, setSubTaskAttachmentReq] = useState<Record<number, boolean>>({})

  // Project list filters and sorting
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<"newest" | "progress_high" | "progress_low">("newest")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [plansData, projectsData, templatesData, tagsData, typesData] = await Promise.all([
        projectService.getPlans(),
        projectService.getProjects(),
        projectService.getWorkflowTemplates(),
        settingsService.getAdminTags(),
        projectService.getProjectTypes(),
      ])
      setPlans(plansData)
      setProjects(projectsData)
      setTemplates(templatesData)
      setAdminTags(tagsData)
      setProjectTypes(typesData)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Plan operations
  const openPlanForm = (plan?: Plan) => {
    setEditingPlan(plan || null)
    setPlanFormData({
      name: plan?.name || "",
      description: plan?.description || "",
      type: plan?.type || "",
    })
    setWorkflowSteps(
      plan?.workflow || [
        { id: "step-1", name: "提案", type: "status" },
        { id: "step-2", name: "審核", type: "approval" },
        { id: "step-3", name: "執行中", type: "status" },
        { id: "step-4", name: "結案", type: "status" },
      ]
    )
    setSelectedTemplate("")
    setIsPlanFormOpen(true)
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setWorkflowSteps([...template.steps])
    }
  }

  const addStep = () => {
    setWorkflowSteps([
      ...workflowSteps,
      { id: `step-${Date.now()}`, name: "新步驟", type: "status" },
    ])
  }

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const newSteps = [...workflowSteps]
    newSteps[index] = { ...newSteps[index], ...updates }
    setWorkflowSteps(newSteps)
  }

  const removeStep = (index: number) => {
    if (workflowSteps.length <= 2) {
      alert("至少需要 2 個流程步驟")
      return
    }
    setWorkflowSteps(workflowSteps.filter((_, i) => i !== index))
  }

  // Sub-tasks management (inline)
  const addSubTask = (stepIndex: number) => {
    const input = subTaskInputs[stepIndex]?.trim()
    if (!input) return

    const newSubTask: SubTask = {
      id: `subtask-${Date.now()}`,
      name: input,
      completed: false,
      requireAttachment: subTaskAttachmentReq[stepIndex] || false,
    }

    const newSteps = [...workflowSteps]
    const step = newSteps[stepIndex]
    step.subTasks = [...(step.subTasks || []), newSubTask]
    setWorkflowSteps(newSteps)
    setSubTaskInputs({ ...subTaskInputs, [stepIndex]: "" })
    setSubTaskAttachmentReq({ ...subTaskAttachmentReq, [stepIndex]: false })
  }

  const removeSubTask = (stepIndex: number, subTaskId: string) => {
    const newSteps = [...workflowSteps]
    const step = newSteps[stepIndex]
    step.subTasks = step.subTasks?.filter((st) => st.id !== subTaskId)
    setWorkflowSteps(newSteps)
  }

  const updateSubTaskInput = (stepIndex: number, value: string) => {
    setSubTaskInputs({ ...subTaskInputs, [stepIndex]: value })
  }

  const handleSavePlan = async () => {
    if (!user) return

    if (!planFormData.name || workflowSteps.length < 2) {
      alert("請填寫計畫名稱並設定至少 2 個流程步驟")
      return
    }

    setIsSavingPlan(true)
    try {
      const data = {
        name: planFormData.name,
        description: planFormData.description,
        type: planFormData.type || "一般",
        workflow: workflowSteps,
        status: "active" as const,
        createdBy: user.id,
      }

      if (editingPlan) {
        await projectService.updatePlan(editingPlan.id, data)
      } else {
        await projectService.createPlan(data)
      }

      await loadData()
      setIsPlanFormOpen(false)
    } catch (error) {
      console.error("Failed to save plan:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSavingPlan(false)
    }
  }

  // Archive plan function - kept for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleArchivePlan = async (plan: Plan) => {
    if (!confirm("確定要封存此計畫嗎？")) return

    try {
      await projectService.archivePlan(plan.id)
      await loadData()
      if (selectedPlan?.id === plan.id) {
        setSelectedPlan(null)
        setSelectedProject(null)
      }
    } catch (error) {
      console.error("Failed to archive plan:", error)
    }
  }
  void handleArchivePlan // Suppress unused warning

  // Project operations
  const openProjectForm = (project?: Project) => {
    setEditingProject(project || null)
    setProjectFormData({
      name: project?.name || "",
      description: project?.description || "",
      projectType: project?.projectType || "",
      budgetAmount: project?.budgetAmount || 0,
    })
    setIsProjectFormOpen(true)
  }

  const handleSaveProject = async () => {
    if (!user || !selectedPlan) return

    if (!projectFormData.name) {
      alert("請填寫專案名稱")
      return
    }

    const selectedType = projectTypes.find((t) => t.name === projectFormData.projectType)
    if (selectedType) {
      if (
        projectFormData.budgetAmount < selectedType.budgetMin ||
        projectFormData.budgetAmount > selectedType.budgetMax
      ) {
        alert(
          `預算金額需在 ${selectedType.budgetMin.toLocaleString()} ~ ${selectedType.budgetMax.toLocaleString()} 範圍內`
        )
        return
      }
    }

    setIsSavingProject(true)
    try {
      if (editingProject) {
        await projectService.updateProject(editingProject.id, {
          name: projectFormData.name,
          description: projectFormData.description,
          projectType: projectFormData.projectType,
          budgetAmount: projectFormData.budgetAmount,
        })
      } else {
        // Initialize workflow with sub-tasks from plan
        const workflow: WorkflowStep[] = selectedPlan.workflow.map((step, index) => ({
          ...step,
          status: index === 0 ? "in_progress" : "pending",
          subTasks: step.subTasks?.map((st) => ({ ...st, completed: false })),
        }))

        await projectService.createProject({
          planId: selectedPlan.id,
          name: projectFormData.name,
          description: projectFormData.description,
          projectType: projectFormData.projectType || "一般",
          budgetAmount: projectFormData.budgetAmount,
          workflow,
          currentStep: 0,
          status: "active",
          createdBy: user.id,
        })
      }

      await loadData()
      setIsProjectFormOpen(false)
    } catch (error) {
      console.error("Failed to save project:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSavingProject(false)
    }
  }

  const handleArchiveProject = async (project: Project) => {
    if (!confirm("確定要封存此專案嗎？")) return

    try {
      await projectService.updateProject(project.id, { status: "archived" })
      await loadData()
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
      }
    } catch (error) {
      console.error("Failed to archive project:", error)
    }
  }

  // Workflow operations
  const openApprovalDialog = (step: WorkflowStep) => {
    setApprovalStep(step)
    setApprovalNote("")
    setApprovalAttachments((step.attachments as ImageUploadResult[]) || [])
    setIsApprovalOpen(true)
  }

  const handleApproval = async (approved: boolean) => {
    if (!selectedProject || !approvalStep || !user) return

    if (!approved && !approvalNote.trim()) {
      alert(approvalStep.type === "establishment" ? "不成立時請填寫原因" : "拒絕時請填寫原因")
      return
    }

    // Check attachment requirement
    if (approved && approvalStep.requireAttachment && approvalAttachments.length === 0) {
      alert("此步驟需要上傳附件才能審核通過")
      return
    }

    setIsProcessing(true)
    try {
      // Update project with attachments
      const newWorkflow = [...selectedProject.workflow]
      const stepIndex = newWorkflow.findIndex((s) => s.id === approvalStep.id)
      if (stepIndex !== -1) {
        newWorkflow[stepIndex] = {
          ...newWorkflow[stepIndex],
          attachments: approvalAttachments as ImageData[],
        }
        await projectService.updateProject(selectedProject.id, { workflow: newWorkflow })
      }

      // For establishment type, mark project as not_established when rejected
      if (approvalStep.type === "establishment" && !approved) {
        await projectService.updateProject(selectedProject.id, { status: "not_established" })
        // Also update the step status to not_established
        const workflow = [...selectedProject.workflow]
        const idx = workflow.findIndex((s) => s.id === approvalStep.id)
        if (idx !== -1) {
          workflow[idx] = {
            ...workflow[idx],
            status: "not_established",
            approvedBy: user.id,
            approvedAt: new Date().toISOString(),
            note: approvalNote || undefined,
          }
          await projectService.updateProject(selectedProject.id, { workflow })
        }
        await loadData()
        setSelectedProject(null) // Go back to project list
        setIsApprovalOpen(false)
        return
      }

      await projectService.advanceWorkflow(
        selectedProject.id,
        approvalStep.id,
        user.id,
        approved,
        approvalNote || undefined
      )

      await loadData()
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

  const toggleSubTaskCompletion = async (project: Project, stepIndex: number, subTaskId: string) => {
    if (!user) return

    const newWorkflow = [...project.workflow]
    const step = newWorkflow[stepIndex]
    const subTask = step.subTasks?.find((st) => st.id === subTaskId)

    if (subTask) {
      subTask.completed = !subTask.completed
      if (subTask.completed) {
        subTask.completedBy = user.id
        subTask.completedAt = new Date().toISOString()
      } else {
        subTask.completedBy = undefined
        subTask.completedAt = undefined
      }

      await projectService.updateProject(project.id, { workflow: newWorkflow })
      await loadData()

      const updated = await projectService.getProjectById(project.id)
      if (updated) setSelectedProject(updated)
    }
  }

  const canAdvanceStep = (step: WorkflowStep) => {
    // Check if all sub-tasks are completed
    if (step.subTasks && step.subTasks.length > 0) {
      return step.subTasks.every((st) => st.completed)
    }
    return true
  }

  const advanceStatus = async (project: Project) => {
    if (!user) return

    const currentStep = project.workflow[project.currentStep]
    if (!currentStep || currentStep.type !== "status") return

    if (!canAdvanceStep(currentStep)) {
      alert("請先完成所有子任務")
      return
    }

    try {
      await projectService.advanceWorkflow(project.id, currentStep.id, user.id, true)
      await loadData()

      const updated = await projectService.getProjectById(project.id)
      if (updated) setSelectedProject(updated)
    } catch (error) {
      console.error("Failed to advance status:", error)
    }
  }

  const canApprove = (step: WorkflowStep) => {
    if (!user || user.role !== "admin") return false
    if (step.type !== "approval" && step.type !== "establishment") return false

    if (step.approverTagId && user.adminTags) {
      return user.adminTags.includes(step.approverTagId)
    }

    return true
  }

  const getTagName = (tagId: string) => {
    return adminTags.find((t) => t.id === tagId)?.name || tagId
  }

  // Template modal
  const openTemplateModal = (workflow: WorkflowStep[]) => {
    setViewingTemplateWorkflow(workflow)
    setIsTemplateModalOpen(true)
  }

  // Derived data
  const activePlans = plans.filter((p) => p.status === "active")

  // Get unique project types and workflow stages for filters
  const uniqueProjectTypes = selectedPlan
    ? [...new Set(projects.filter((p) => p.planId === selectedPlan.id).map((p) => p.projectType))]
    : []
  const uniqueStages = selectedPlan?.workflow.map((s) => s.name) || []

  // Filter and sort projects
  const planProjects = selectedPlan
    ? projects
        .filter((p) => p.planId === selectedPlan.id)
        .filter((p) => {
          // Status filter
          if (statusFilter.length > 0) {
            const projectStatus = p.status === "completed" ? "成立"
              : p.status === "not_established" ? "不成立"
              : "進行中"
            if (!statusFilter.includes(projectStatus)) return false
          }
          // Type filter
          if (typeFilter.length > 0 && !typeFilter.includes(p.projectType)) return false
          // Stage filter
          if (stageFilter.length > 0) {
            const currentStepName = p.workflow[p.currentStep]?.name
            if (!currentStepName || !stageFilter.includes(currentStepName)) return false
          }
          return true
        })
        .sort((a, b) => {
          if (sortBy === "newest") {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          }
          const progressA = (a.workflow.filter((s) => s.status === "approved").length / a.workflow.length) * 100
          const progressB = (b.workflow.filter((s) => s.status === "approved").length / b.workflow.length) * 100
          return sortBy === "progress_high" ? progressB - progressA : progressA - progressB
        })
    : []

  // Toggle filter helper
  const toggleFilter = (
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value))
    } else {
      setter([...current, value])
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">計畫管理</h1>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">載入中...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render workflow steps as horizontal flow
  const renderWorkflowSteps = (workflow: WorkflowStep[], _currentStep?: number) => (
    <div className="flex items-center justify-center gap-2 flex-wrap py-4">
      {workflow.map((step, index) => {
        const stepStatus = step.status
        const hasSubTasks = step.subTasks && step.subTasks.length > 0
        const subTasksCompleted = step.subTasks?.filter((st) => st.completed).length || 0
        const totalSubTasks = step.subTasks?.length || 0

        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all relative ${
                  stepStatus === "approved"
                    ? "bg-primary text-primary-foreground"
                    : stepStatus === "in_progress"
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : stepStatus === "rejected" || stepStatus === "not_established"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {stepStatus === "approved" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : stepStatus === "rejected" || stepStatus === "not_established" ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  index + 1
                )}
                {/* Sub-tasks indicator */}
                {hasSubTasks && stepStatus !== "approved" && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-warning text-warning-foreground text-xs rounded-full flex items-center justify-center">
                    {subTasksCompleted}/{totalSubTasks}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1.5 text-center max-w-[60px] leading-tight">
                {step.name}
              </span>
              {/* Indicators */}
              <div className="flex gap-1 mt-1">
                {step.requireAttachment && (
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                )}
                {hasSubTasks && (
                  <ListChecks className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
            {index < workflow.length - 1 && (
              <Play
                className={`h-3 w-3 ${
                  stepStatus === "approved"
                    ? "text-primary"
                    : "text-muted-foreground/40"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(selectedPlan || selectedProject) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedProject) {
                  setSelectedProject(null)
                } else {
                  setSelectedPlan(null)
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">計畫管理</h1>
            <p className="text-muted-foreground">
              {selectedProject
                ? `${selectedPlan?.name} / ${selectedProject.name}`
                : selectedPlan
                ? selectedPlan.name
                : "管理計畫與專案"}
            </p>
          </div>
        </div>
        {!selectedProject && (
          <Button onClick={() => (selectedPlan ? openProjectForm() : openPlanForm())}>
            <Plus className="h-4 w-4 mr-1" />
            {selectedPlan ? "新增專案" : "新增計畫"}
          </Button>
        )}
      </div>

      {/* Level 1: Plans List */}
      {!selectedPlan && (
        <section className="space-y-6">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-light text-primary">01</span>
            <h2 className="text-xl font-medium">選擇計畫</h2>
          </div>

          {activePlans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                尚無計畫，點擊上方按鈕新增
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePlans.map((plan) => {
                const planProjectCount = projects.filter((p) => p.planId === plan.id).length

                return (
                  <Card
                    key={plan.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {plan.name}
                          </h3>
                          <Badge variant="secondary" className="mt-1">
                            {plan.type}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-light text-primary">
                            {planProjectCount}
                          </span>
                          <p className="text-xs text-muted-foreground">專案</p>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {plan.description || "無描述"}
                      </p>

                      {/* Workflow Preview - Icon Button */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {plan.workflow.length} 個步驟
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              openTemplateModal(plan.workflow)
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            查看流程
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(plan.createdAt), "yyyy/MM/dd")}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openPlanForm(plan)
                          }}
                        >
                          編輯
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Level 2: Projects List */}
      {selectedPlan && !selectedProject && (
        <section className="space-y-6">
          {/* Title with template button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-5xl font-light text-primary">02</span>
              <h2 className="text-xl font-medium">選擇專案</h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => openTemplateModal(selectedPlan.workflow)}
              >
                <Eye className="h-4 w-4 mr-1" />
                查看流程範本
              </Button>
            </div>
          </div>

          {/* Filters and Sort Controls */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-start gap-6">
                {/* Status Filter */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    成立狀態
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["進行中", "成立", "不成立"].map((status) => (
                      <Badge
                        key={status}
                        variant={statusFilter.includes(status) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => toggleFilter(statusFilter, setStatusFilter, status)}
                      >
                        {status}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Project Type Filter */}
                {uniqueProjectTypes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">專案類型</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueProjectTypes.map((type) => (
                        <Badge
                          key={type}
                          variant={typeFilter.includes(type) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-primary/10"
                          onClick={() => toggleFilter(typeFilter, setTypeFilter, type)}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage Filter */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">流程階段</p>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueStages.map((stage) => (
                      <Badge
                        key={stage}
                        variant={stageFilter.includes(stage) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => toggleFilter(stageFilter, setStageFilter, stage)}
                      >
                        {stage}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Sort Control */}
                <div className="space-y-2 ml-auto">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    排序
                  </p>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-36 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">最新建立</SelectItem>
                      <SelectItem value="progress_high">進度高→低</SelectItem>
                      <SelectItem value="progress_low">進度低→高</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active filters summary */}
              {(statusFilter.length > 0 || typeFilter.length > 0 || stageFilter.length > 0) && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">篩選中：</span>
                  <span className="text-xs font-medium">
                    {planProjects.length} / {projects.filter((p) => p.planId === selectedPlan.id).length} 專案
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setStatusFilter([])
                      setTypeFilter([])
                      setStageFilter([])
                    }}
                  >
                    清除篩選
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {planProjects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {projects.filter((p) => p.planId === selectedPlan.id).length === 0
                  ? "此計畫下尚無專案"
                  : "無符合篩選條件的專案"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {planProjects.map((project) => {
                const progress =
                  (project.workflow.filter((s) => s.status === "approved").length /
                    project.workflow.length) *
                  100
                const currentStep = project.workflow[project.currentStep]

                return (
                  <Card
                    key={project.id}
                    className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group ${
                      project.status === "archived" || project.status === "not_established" ? "opacity-60" : ""
                    }`}
                    onClick={() => setSelectedProject(project)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{project.projectType}</Badge>
                            {project.status === "not_established" && (
                              <Badge variant="destructive" className="text-xs">不成立</Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              ${project.budgetAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {project.description || "無描述"}
                      </p>

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {currentStep?.name || "已完成"}
                          </span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Creation date */}
                      <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                        建立於 {format(new Date(project.createdAt), "yyyy/MM/dd")}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Level 3: Project Details */}
      {selectedProject && (
        <section className="space-y-6">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-light text-primary">03</span>
            <h2 className="text-xl font-medium">專案詳情</h2>
          </div>

          {/* Project Info Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <Badge
                    variant={
                      selectedProject.status === "active"
                        ? "default"
                        : selectedProject.status === "completed"
                        ? "success"
                        : selectedProject.status === "not_established"
                        ? "destructive"
                        : "secondary"
                    }
                    className="mb-2"
                  >
                    {selectedProject.status === "active"
                      ? "進行中"
                      : selectedProject.status === "completed"
                      ? "已完成"
                      : selectedProject.status === "not_established"
                      ? "不成立"
                      : "已封存"}
                  </Badge>
                  <div className="grid grid-cols-2 gap-6 mt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">專案類型</p>
                      <p className="font-medium">{selectedProject.projectType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">預算金額</p>
                      <p className="font-medium">${selectedProject.budgetAmount.toLocaleString()}</p>
                    </div>
                  </div>
                  {selectedProject.description && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">描述</p>
                      <p className="mt-1">{selectedProject.description}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openProjectForm(selectedProject)}
                  >
                    編輯
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchiveProject(selectedProject)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Progress */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-medium mb-4 text-center">流程進度</h3>
              {renderWorkflowSteps(selectedProject.workflow, selectedProject.currentStep)}

              {/* Current Step Actions */}
              {selectedProject.status === "active" && (
                <div className="mt-6 pt-6 border-t">
                  {selectedProject.workflow.map((step, index) => {
                    if (index !== selectedProject.currentStep) return null
                    if (step.status !== "in_progress") return null

                    const allSubTasksComplete = canAdvanceStep(step)

                    return (
                      <div key={step.id} className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                          目前步驟：<span className="font-medium text-foreground">{step.name}</span>
                          {step.approverTagId && (
                            <span className="ml-2">
                              （{step.type === "establishment" ? "審核人" : "審批人"}：{getTagName(step.approverTagId)}）
                            </span>
                          )}
                        </p>

                        {/* Sub-tasks status */}
                        {step.subTasks && step.subTasks.length > 0 && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                            <ListChecks className="h-4 w-4" />
                            <span className="text-sm">
                              子任務：{step.subTasks.filter((st) => st.completed).length} / {step.subTasks.length}
                            </span>
                          </div>
                        )}

                        {/* Attachment requirement notice */}
                        {step.requireAttachment && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning-foreground rounded-full">
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm">此步驟需要上傳附件</span>
                          </div>
                        )}

                        {step.type === "status" ? (
                          <Button
                            onClick={() => advanceStatus(selectedProject)}
                            disabled={!allSubTasksComplete}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            完成此步驟
                          </Button>
                        ) : canApprove(step) ? (
                          <Button
                            onClick={() => openApprovalDialog(step)}
                            disabled={!allSubTasksComplete}
                          >
                            {step.type === "establishment" ? "進行成立審核" : "進行審批"}
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {step.type === "establishment" ? "等待成立審核中..." : "等待審批中..."}
                          </p>
                        )}

                        {!allSubTasksComplete && (
                          <p className="text-xs text-destructive">請先完成所有子任務</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Details - Only show completed and current steps */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-medium mb-4">步驟明細</h3>
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-4">
                  {selectedProject.workflow
                    .map((step, index) => ({ step, index }))
                    .filter(({ step, index }) =>
                      // Only show: approved, rejected, not_established, or current in_progress step
                      step.status === "approved" ||
                      step.status === "rejected" ||
                      step.status === "not_established" ||
                      (step.status === "in_progress" && index === selectedProject.currentStep)
                    )
                    .map(({ step, index }) => {
                      const isRejectedOrNotEstablished = step.status === "rejected" || step.status === "not_established"

                      return (
                        <div
                          key={step.id}
                          className={`p-4 rounded-lg border ${
                            index === selectedProject.currentStep && selectedProject.status === "active"
                              ? "border-primary bg-primary/5"
                              : isRejectedOrNotEstablished
                              ? "border-destructive/50 bg-destructive/5"
                              : ""
                          }`}
                        >
                          {/* Step Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                                  step.status === "approved"
                                    ? "bg-primary text-primary-foreground"
                                    : isRejectedOrNotEstablished
                                    ? "bg-destructive text-destructive-foreground"
                                    : step.status === "in_progress"
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {step.status === "approved" ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : isRejectedOrNotEstablished ? (
                                  <XCircle className="h-5 w-5" />
                                ) : (
                                  index + 1
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-base">{step.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge
                                    variant={step.type === "approval" || step.type === "establishment" ? "warning" : "secondary"}
                                    className="text-xs"
                                  >
                                    {step.type === "approval" ? "審批" : step.type === "establishment" ? "成立審核" : "狀態"}
                                  </Badge>
                                  {step.approverTagId && (
                                    <span className="text-xs text-muted-foreground">
                                      {getTagName(step.approverTagId)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant={
                                step.status === "approved"
                                  ? "success"
                                  : isRejectedOrNotEstablished
                                  ? "destructive"
                                  : step.status === "in_progress"
                                  ? "warning"
                                  : "outline"
                              }
                            >
                              {step.status === "approved"
                                ? "已通過"
                                : step.status === "rejected"
                                ? "已拒絕"
                                : step.status === "not_established"
                                ? "不成立"
                                : step.status === "in_progress"
                                ? "進行中"
                                : "待處理"}
                            </Badge>
                          </div>

                          {/* Rejection / Not Established Note - Prominent Display */}
                          {isRejectedOrNotEstablished && step.note && (
                            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-destructive">
                                    {step.status === "not_established" ? "不成立原因" : "退回原因"}
                                  </p>
                                  <p className="text-sm mt-1">{step.note}</p>
                                  {step.approvedAt && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {format(new Date(step.approvedAt), "yyyy/MM/dd HH:mm")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Approval Note - For approved steps */}
                          {step.status === "approved" && step.note && (
                            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">審批備註</p>
                                  <p className="text-sm mt-1">{step.note}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Sub-tasks */}
                          {step.subTasks && step.subTasks.length > 0 && (
                            <div className="mt-4 pl-13 space-y-2">
                              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                <ListChecks className="h-3 w-3" />
                                子任務
                              </p>
                              <div className="space-y-1.5">
                                {step.subTasks.map((subTask) => (
                                  <div
                                    key={subTask.id}
                                    className="flex items-center gap-2 p-2 bg-muted/30 rounded"
                                  >
                                    <Checkbox
                                      checked={subTask.completed}
                                      onCheckedChange={() =>
                                        toggleSubTaskCompletion(selectedProject, index, subTask.id)
                                      }
                                      disabled={
                                        step.status === "approved" ||
                                        step.status === "rejected" ||
                                        step.status === "not_established" ||
                                        index !== selectedProject.currentStep
                                      }
                                    />
                                    <span
                                      className={`text-sm flex-1 ${
                                        subTask.completed ? "line-through text-muted-foreground" : ""
                                      }`}
                                    >
                                      {subTask.name}
                                    </span>
                                    {subTask.requireAttachment && (
                                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    {subTask.completedAt && (
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(subTask.completedAt), "MM/dd HH:mm")}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Attachments - Expanded Display */}
                          {step.attachments && step.attachments.length > 0 && (
                            <div className="mt-4 pl-13">
                              <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                附件 ({step.attachments.length})
                              </p>
                              <div className="grid grid-cols-4 gap-2">
                                {step.attachments.map((att) => (
                                  <a
                                    key={att.id}
                                    href={att.originalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block aspect-[4/3] rounded-lg overflow-hidden border hover:border-primary transition-colors"
                                  >
                                    <img
                                      src={att.thumbnailUrl || att.originalUrl}
                                      alt={att.fileName}
                                      className="w-full h-full object-cover"
                                    />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Timestamp for approved steps (without note) */}
                          {step.status === "approved" && step.approvedAt && !step.note && (
                            <p className="text-xs text-muted-foreground mt-3 pl-13">
                              完成於 {format(new Date(step.approvedAt), "yyyy/MM/dd HH:mm")}
                            </p>
                          )}
                        </div>
                      )
                    })}
                </div>

                {/* Remaining steps indicator */}
                {selectedProject.workflow.filter((s) => s.status === "pending").length > 0 && (
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      還有 {selectedProject.workflow.filter((s) => s.status === "pending").length} 個步驟待完成
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            建立時間：{format(new Date(selectedProject.createdAt), "yyyy/MM/dd HH:mm")}
          </p>
        </section>
      )}

      {/* Template Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>流程範本</DialogTitle>
            <DialogDescription>此計畫的標準流程</DialogDescription>
          </DialogHeader>

          {viewingTemplateWorkflow && (
            <div className="py-4">
              {renderWorkflowSteps(viewingTemplateWorkflow)}

              <div className="mt-6 space-y-3">
                {viewingTemplateWorkflow.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{step.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={step.type === "approval" || step.type === "establishment" ? "warning" : "secondary"} className="text-xs">
                          {step.type === "approval" ? "審批" : step.type === "establishment" ? "成立審核" : "狀態"}
                        </Badge>
                        {step.approverTagId && (
                          <span className="text-xs text-muted-foreground">
                            審批人：{getTagName(step.approverTagId)}
                          </span>
                        )}
                        {step.requireAttachment && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            需附件
                          </span>
                        )}
                        {step.subTasks && step.subTasks.length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ListChecks className="h-3 w-3" />
                            {step.subTasks.length} 個子任務
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan Form Dialog */}
      <Dialog open={isPlanFormOpen} onOpenChange={setIsPlanFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "編輯計畫" : "新增計畫"}</DialogTitle>
            <DialogDescription>設定計畫基本資訊與流程</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>計畫名稱 *</Label>
                  <Input
                    value={planFormData.name}
                    onChange={(e) =>
                      setPlanFormData({ ...planFormData, name: e.target.value })
                    }
                    placeholder="例如：勁力守護計畫"
                  />
                </div>
                <div className="space-y-2">
                  <Label>計畫類型</Label>
                  <Input
                    value={planFormData.type}
                    onChange={(e) =>
                      setPlanFormData({ ...planFormData, type: e.target.value })
                    }
                    placeholder="例如：社會福利"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>計畫描述</Label>
                <textarea
                  className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={planFormData.description}
                  onChange={(e) =>
                    setPlanFormData({ ...planFormData, description: e.target.value })
                  }
                  placeholder="描述計畫目標..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>流程設定</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="套用範本" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {workflowSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="text-sm font-medium w-8 pt-2">{index + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          value={step.name}
                          onChange={(e) => updateStep(index, { name: e.target.value })}
                          placeholder="步驟名稱"
                        />
                        <Select
                          value={step.type}
                          onValueChange={(v) =>
                            updateStep(index, { type: v as "status" | "approval" | "establishment" })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="status">狀態</SelectItem>
                            <SelectItem value="approval">審批</SelectItem>
                            <SelectItem value="establishment">成立審核</SelectItem>
                          </SelectContent>
                        </Select>
                        {(step.type === "approval" || step.type === "establishment") && (
                          <Select
                            value={step.approverTagId || ""}
                            onValueChange={(v) =>
                              updateStep(index, { approverTagId: v, approverType: "tag" })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="審批人" />
                            </SelectTrigger>
                            <SelectContent>
                              {adminTags.map((tag) => (
                                <SelectItem key={tag.id} value={tag.id}>
                                  {tag.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Step options */}
                      <div className="flex items-center gap-4 pl-1">
                        {(step.type === "approval" || step.type === "establishment") && (
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={step.requireAttachment || false}
                              onCheckedChange={(checked) =>
                                updateStep(index, { requireAttachment: !!checked })
                              }
                            />
                            <Paperclip className="h-3 w-3" />
                            需上傳附件
                          </label>
                        )}
                      </div>

                      {/* Sub-tasks section */}
                      <div className="space-y-2 pl-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <ListChecks className="h-3 w-3" />
                          子任務
                        </p>

                        {/* Existing sub-tasks */}
                        {step.subTasks && step.subTasks.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {step.subTasks.map((st) => (
                              <Badge key={st.id} variant="outline" className="text-xs flex items-center gap-1">
                                {st.requireAttachment && <Paperclip className="h-2.5 w-2.5" />}
                                {st.name}
                                <button
                                  type="button"
                                  className="ml-1 hover:text-destructive"
                                  onClick={() => removeSubTask(index, st.id)}
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Inline add sub-task input */}
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8 text-sm flex-1"
                            placeholder="輸入子任務名稱，按 Enter 新增"
                            value={subTaskInputs[index] || ""}
                            onChange={(e) => updateSubTaskInput(index, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                addSubTask(index)
                              }
                            }}
                          />
                          <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <Checkbox
                              checked={subTaskAttachmentReq[index] || false}
                              onCheckedChange={(checked) =>
                                setSubTaskAttachmentReq({ ...subTaskAttachmentReq, [index]: !!checked })
                              }
                              className="h-3.5 w-3.5"
                            />
                            <Paperclip className="h-3 w-3" />
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => addSubTask(index)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" />
                新增步驟
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSavePlan} disabled={isSavingPlan}>
              {isSavingPlan ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Form Dialog */}
      <Dialog open={isProjectFormOpen} onOpenChange={setIsProjectFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? "編輯專案" : "新增專案"}</DialogTitle>
            <DialogDescription>
              {selectedPlan?.name} 下的專案
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>專案名稱 *</Label>
              <Input
                value={projectFormData.name}
                onChange={(e) =>
                  setProjectFormData({ ...projectFormData, name: e.target.value })
                }
                placeholder="例如：112年度急難救助"
              />
            </div>

            <div className="space-y-2">
              <Label>專案描述</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={projectFormData.description}
                onChange={(e) =>
                  setProjectFormData({ ...projectFormData, description: e.target.value })
                }
                placeholder="描述專案內容..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>專案類型</Label>
                <Select
                  value={projectFormData.projectType}
                  onValueChange={(v) =>
                    setProjectFormData({ ...projectFormData, projectType: v })
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
                  value={projectFormData.budgetAmount}
                  onChange={(e) =>
                    setProjectFormData({
                      ...projectFormData,
                      budgetAmount: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjectFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveProject} disabled={isSavingProject}>
              {isSavingProject ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalOpen} onOpenChange={setIsApprovalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {approvalStep?.type === "establishment" ? "成立審核" : "審批"}：{approvalStep?.name}
            </DialogTitle>
            <DialogDescription>專案：{selectedProject?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>備註說明</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder={approvalStep?.type === "establishment" ? "選填，不成立時必填..." : "選填，拒絕時必填..."}
              />
            </div>

            {/* Attachment upload */}
            {approvalStep?.requireAttachment && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  上傳附件 *
                </Label>
                <p className="text-xs text-muted-foreground">
                  此步驟需要上傳附件才能審核通過
                </p>
                <MultiImageUploader
                  type="receipt"
                  value={approvalAttachments}
                  onChange={setApprovalAttachments}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleApproval(false)}
              disabled={isProcessing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {approvalStep?.type === "establishment" ? "不成立" : "拒絕"}
            </Button>
            <Button onClick={() => handleApproval(true)} disabled={isProcessing}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {approvalStep?.type === "establishment" ? "成立" : "通過"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
