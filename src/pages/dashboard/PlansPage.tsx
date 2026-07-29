import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
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
import { projectService, settingsService, organizationService, workflowService, type ImageUploadResult } from "@/services"
import type {
  Plan,
  Project,
  WorkflowStep,
  WorkflowTemplate,
  AdminTag,
  ProjectType,
  SubTask,
  ImageData,
  OrganizationWithDetails,
  WorkflowStepExecutionWithDetails,
} from "@/types"
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
  Edit as EditIcon,
  FolderKanban,
  FileText,
  Building2,
  ChevronRight,
  Search,
  Users,
  Clock,
  Send,
  RotateCcw,
  History,
} from "lucide-react"
import { cn } from "@/lib/utils"

type MobileView = "plans" | "projects" | "detail"

export function PlansPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [adminTags, setAdminTags] = useState<AdminTag[]>([])
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])
  const [organizations, setOrganizations] = useState<OrganizationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Navigation state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>("plans")

  // Search state
  const [planSearch, setPlanSearch] = useState("")
  const [projectSearch, setProjectSearch] = useState("")

  // Dialog states
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [viewingTemplateWorkflow, _setViewingTemplateWorkflow] = useState<WorkflowStep[] | null>(null)

  // Plan view dialog state
  const [isPlanViewOpen, setIsPlanViewOpen] = useState(false)
  const [viewingPlan, setViewingPlan] = useState<Plan | null>(null)
  const [viewingPlanOrgCount, setViewingPlanOrgCount] = useState(0)
  const [viewingPlanOrgs, setViewingPlanOrgs] = useState<OrganizationWithDetails[]>([])
  const [isLoadingPlanView, setIsLoadingPlanView] = useState(false)

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
    organizationId: "",
  })
  const [isSavingProject, setIsSavingProject] = useState(false)

  // Workflow execution state
  const [stepExecutions, setStepExecutions] = useState<WorkflowStepExecutionWithDetails[]>([])
  const [_isLoadingExecutions, setIsLoadingExecutions] = useState(false)
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false)
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<WorkflowStepExecutionWithDetails | null>(null)
  const [submitForm, setSubmitForm] = useState({ content: "", attachments: [] as ImageUploadResult[] })
  const [verifyForm, setVerifyForm] = useState({ approved: true, rejectReason: "" })
  const [isProcessing, setIsProcessing] = useState(false)

  // Sub-tasks inline input (per step)
  const [subTaskInputs, setSubTaskInputs] = useState<Record<number, string>>({})
  const [subTaskAttachmentReq, setSubTaskAttachmentReq] = useState<Record<number, boolean>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [plansData, projectsData, templatesData, tagsData, typesData, orgsData] = await Promise.all([
        projectService.getPlans(),
        projectService.getProjects(),
        projectService.getWorkflowTemplates(),
        settingsService.getAdminTags(),
        projectService.getProjectTypes(),
        organizationService.getOrganizations(),
      ])
      setPlans(plansData)
      setProjects(projectsData)
      setTemplates(templatesData)
      setAdminTags(tagsData)
      setProjectTypes(typesData)
      setOrganizations(orgsData)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load executions when project is selected
  useEffect(() => {
    if (selectedProject) {
      loadProjectExecutions(selectedProject.id)
    }
  }, [selectedProject])

  const loadProjectExecutions = async (projectId: string) => {
    setIsLoadingExecutions(true)
    try {
      const executions = await workflowService.getProjectExecutions(projectId)
      setStepExecutions(executions)
    } catch (error) {
      console.error("Failed to load executions:", error)
    } finally {
      setIsLoadingExecutions(false)
    }
  }

  // Plan view operations
  const openPlanView = async (plan: Plan) => {
    setViewingPlan(plan)
    setIsPlanViewOpen(true)
    setIsLoadingPlanView(true)

    try {
      const [count, orgs] = await Promise.all([
        organizationService.getOrganizationCountByPlan(plan.id),
        organizationService.getOrganizationsByPlan(plan.id),
      ])
      setViewingPlanOrgCount(count)
      setViewingPlanOrgs(orgs)
    } catch (error) {
      console.error("Failed to load plan organizations:", error)
      setViewingPlanOrgCount(0)
      setViewingPlanOrgs([])
    } finally {
      setIsLoadingPlanView(false)
    }
  }

  // Plan operations
  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan)
    setSelectedProject(null)
    setMobileView("projects")
  }

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

  // Project operations
  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setMobileView("detail")
  }

  const openProjectForm = (project?: Project) => {
    setEditingProject(project || null)
    setProjectFormData({
      name: project?.name || "",
      description: project?.description || "",
      projectType: project?.projectType || "",
      budgetAmount: project?.budgetAmount || 0,
      organizationId: project?.organizationId || "",
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
          organizationId: projectFormData.organizationId || undefined,
        })
      } else {
        // Initialize workflow with sub-tasks from plan
        const workflow: WorkflowStep[] = selectedPlan.workflow.map((step, index) => ({
          ...step,
          status: index === 0 ? "in_progress" : "pending",
          currentRound: 1,
          subTasks: step.subTasks?.map((st) => ({ ...st, completed: false })),
        }))

        await projectService.createProject({
          planId: selectedPlan.id,
          organizationId: projectFormData.organizationId || undefined,
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
        setMobileView("projects")
      }
    } catch (error) {
      console.error("Failed to archive project:", error)
    }
  }

  // Workflow execution operations
  const handleSubmitExecution = async () => {
    if (!selectedProject || !user) return

    const currentStep = selectedProject.workflow[selectedProject.currentStep]
    if (!currentStep) return

    setIsProcessing(true)
    try {
      await workflowService.submitExecution(
        selectedProject.id,
        currentStep.id,
        user.id,
        {
          content: submitForm.content,
          attachments: submitForm.attachments as ImageData[],
        }
      )

      await loadProjectExecutions(selectedProject.id)
      setIsSubmitDialogOpen(false)
      setSubmitForm({ content: "", attachments: [] })
    } catch (error) {
      console.error("Failed to submit execution:", error)
      alert("提交失敗，請稍後再試")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleVerifyExecution = async () => {
    if (!selectedExecution || !user) return

    if (!verifyForm.approved && !verifyForm.rejectReason.trim()) {
      alert("退回時請填寫原因")
      return
    }

    setIsProcessing(true)
    try {
      await workflowService.verifyExecution(
        selectedExecution.id,
        user.id,
        verifyForm.approved,
        verifyForm.rejectReason || undefined
      )

      // If approved, advance the workflow
      if (verifyForm.approved && selectedProject) {
        const currentStep = selectedProject.workflow[selectedProject.currentStep]
        if (currentStep) {
          await projectService.advanceWorkflow(
            selectedProject.id,
            currentStep.id,
            user.id,
            true
          )
        }
      }

      await loadData()
      if (selectedProject) {
        const updated = await projectService.getProjectById(selectedProject.id)
        if (updated) {
          setSelectedProject(updated)
          await loadProjectExecutions(updated.id)
        }
      }
      setIsVerifyDialogOpen(false)
      setSelectedExecution(null)
      setVerifyForm({ approved: true, rejectReason: "" })
    } catch (error) {
      console.error("Failed to verify execution:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setIsProcessing(false)
    }
  }

  const openVerifyDialog = (execution: WorkflowStepExecutionWithDetails) => {
    setSelectedExecution(execution)
    setVerifyForm({ approved: true, rejectReason: "" })
    setIsVerifyDialogOpen(true)
  }

  // Sub-task completion
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

  const getTagName = (tagId: string) => {
    return adminTags.find((t) => t.id === tagId)?.name || tagId
  }

  const getOrganizationName = (orgId?: string) => {
    if (!orgId) return null
    return organizations.find((o) => o.id === orgId)?.name || orgId
  }

  // Derived data
  const activePlans = plans.filter((p) => p.status === "active")
  const filteredPlans = activePlans.filter((p) =>
    p.name.toLowerCase().includes(planSearch.toLowerCase())
  )

  const planProjects = selectedPlan
    ? projects
        .filter((p) => p.planId === selectedPlan.id)
        .filter((p) =>
          p.name.toLowerCase().includes(projectSearch.toLowerCase())
        )
    : []

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center text-muted-foreground">載入中...</div>
      </div>
    )
  }

  // Plans Column Component
  const PlansColumn = () => (
    <div className="flex flex-col h-full border-r">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            計畫
          </h2>
          <Button size="sm" onClick={() => openPlanForm()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋計畫..."
            value={planSearch}
            onChange={(e) => setPlanSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredPlans.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {planSearch ? "無符合的計畫" : "尚無計畫"}
            </div>
          ) : (
            filteredPlans.map((plan) => {
              const projectCount = projects.filter((p) => p.planId === plan.id).length
              const isSelected = selectedPlan?.id === plan.id

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                    isSelected && "bg-muted"
                  )}
                  onClick={() => handleSelectPlan(plan)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{plan.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 md:hidden" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {plan.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {projectCount} 專案
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        openPlanView(plan)
                      }}
                      title="檢視計畫"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )

  // Projects Column Component
  const ProjectsColumn = () => (
    <div className="flex flex-col h-full border-r">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={() => {
              setSelectedPlan(null)
              setMobileView("plans")
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-between flex-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              專案
            </h2>
            {selectedPlan && (
              <Button size="sm" onClick={() => openProjectForm()}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {selectedPlan && (
          <>
            <p className="text-sm text-muted-foreground truncate">
              {selectedPlan.name}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋專案..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        {!selectedPlan ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            請選擇計畫
          </div>
        ) : planProjects.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            {projectSearch ? "無符合的專案" : "此計畫下尚無專案"}
          </div>
        ) : (
          <div className="divide-y">
            {planProjects.map((project) => {
              const progress =
                (project.workflow.filter((s) => s.status === "approved").length /
                  project.workflow.length) *
                100
              const currentStep = project.workflow[project.currentStep]
              const isSelected = selectedProject?.id === project.id
              const orgName = getOrganizationName(project.organizationId)

              return (
                <div
                  key={project.id}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                    isSelected && "bg-muted",
                    project.status === "archived" && "opacity-60"
                  )}
                  onClick={() => handleSelectProject(project)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{project.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 md:hidden" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {project.projectType}
                        </Badge>
                        {project.status === "not_established" && (
                          <Badge variant="destructive" className="text-xs">
                            不成立
                          </Badge>
                        )}
                        {orgName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {orgName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      {currentStep && project.status === "active" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          目前：{currentStep.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  // Project Detail Column Component
  const ProjectDetailColumn = () => {
    if (!selectedProject) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>選擇一個專案查看詳情</p>
          </div>
        </div>
      )
    }

    const currentStep = selectedProject.workflow[selectedProject.currentStep]
    const currentStepExecutions = stepExecutions.filter(
      (e) => e.stepId === currentStep?.id
    )
    const pendingExecutions = currentStepExecutions.filter(
      (e) => e.verificationStatus === "pending"
    )

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2 md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedProject(null)
                setMobileView("projects")
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selectedProject.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
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
                >
                  {selectedProject.status === "active"
                    ? "進行中"
                    : selectedProject.status === "completed"
                    ? "已完成"
                    : selectedProject.status === "not_established"
                    ? "不成立"
                    : "已封存"}
                </Badge>
                <Badge variant="outline">{selectedProject.projectType}</Badge>
                <span className="text-sm text-muted-foreground">
                  ${selectedProject.budgetAmount.toLocaleString()}
                </span>
                {selectedProject.organizationId && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {getOrganizationName(selectedProject.organizationId)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openProjectForm(selectedProject)}
              >
                編輯
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleArchiveProject(selectedProject)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Workflow Progress */}
            <div>
              <h3 className="font-medium mb-3">流程進度</h3>
              <div className="flex items-center justify-center gap-2 flex-wrap py-4 bg-muted/30 rounded-lg">
                {selectedProject.workflow.map((step, index) => {
                  const hasSubTasks = step.subTasks && step.subTasks.length > 0
                  const subTasksCompleted = step.subTasks?.filter((st) => st.completed).length || 0
                  const totalSubTasks = step.subTasks?.length || 0

                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all relative",
                            step.status === "approved"
                              ? "bg-primary text-primary-foreground"
                              : step.status === "in_progress"
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                              : step.status === "rejected" || step.status === "not_established"
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {step.status === "approved" ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : step.status === "rejected" || step.status === "not_established" ? (
                            <XCircle className="h-5 w-5" />
                          ) : (
                            index + 1
                          )}
                          {hasSubTasks && step.status !== "approved" && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-warning text-warning-foreground text-[10px] rounded-full flex items-center justify-center">
                              {subTasksCompleted}/{totalSubTasks}
                            </span>
                          )}
                        </div>
                        <span className="text-xs mt-1 text-center max-w-[50px] leading-tight">
                          {step.name}
                        </span>
                      </div>
                      {index < selectedProject.workflow.length - 1 && (
                        <Play
                          className={cn(
                            "h-3 w-3",
                            step.status === "approved"
                              ? "text-primary"
                              : "text-muted-foreground/40"
                          )}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Current Step Actions */}
            {selectedProject.status === "active" && currentStep && currentStep.status === "in_progress" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    目前步驟：{currentStep.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Personnel info based on step type */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {/* Approval type: Show 執行人 and 驗收人 */}
                    {currentStep.type === "approval" && (
                      <>
                        {(currentStep.assigneeTagId || currentStep.assigneeUserId) && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>執行人：</span>
                            <Badge variant="outline">
                              {currentStep.assigneeTagId
                                ? getTagName(currentStep.assigneeTagId)
                                : "指定人員"}
                            </Badge>
                          </div>
                        )}
                        {(currentStep.verifierTagId || currentStep.verifierUserId) && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            <span>驗收人：</span>
                            <Badge variant="outline">
                              {currentStep.verifierTagId
                                ? getTagName(currentStep.verifierTagId)
                                : "指定人員"}
                            </Badge>
                          </div>
                        )}
                      </>
                    )}
                    {/* Establishment type: Show only 審核人 */}
                    {currentStep.type === "establishment" && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        <span>審核人：</span>
                        <Badge variant="outline">
                          {currentStep.approverTagId
                            ? getTagName(currentStep.approverTagId)
                            : "不限"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Sub-tasks */}
                  {currentStep.subTasks && currentStep.subTasks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <ListChecks className="h-4 w-4" />
                        子任務
                      </p>
                      <div className="space-y-1">
                        {currentStep.subTasks.map((subTask) => (
                          <div
                            key={subTask.id}
                            className="flex items-center gap-2 p-2 bg-muted/50 rounded"
                          >
                            <Checkbox
                              checked={subTask.completed}
                              onCheckedChange={() =>
                                toggleSubTaskCompletion(
                                  selectedProject,
                                  selectedProject.currentStep,
                                  subTask.id
                                )
                              }
                            />
                            <span
                              className={cn(
                                "text-sm flex-1",
                                subTask.completed && "line-through text-muted-foreground"
                              )}
                            >
                              {subTask.name}
                            </span>
                            {subTask.requireAttachment && (
                              <Paperclip className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {currentStep.type === "status" && (
                      <Button
                        onClick={() => advanceStatus(selectedProject)}
                        disabled={!canAdvanceStep(currentStep)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        完成此步驟
                      </Button>
                    )}
                    {currentStep.type === "approval" && (
                      <Button onClick={() => setIsSubmitDialogOpen(true)}>
                        <Send className="h-4 w-4 mr-2" />
                        提交執行內容
                      </Button>
                    )}
                    {currentStep.type === "establishment" && (
                      <>
                        <Button
                          onClick={() => advanceStatus(selectedProject)}
                          disabled={!canAdvanceStep(currentStep)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          審核通過
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            // For establishment, rejection means project doesn't get established
                            if (confirm("確定要將此專案設為不成立嗎？")) {
                              projectService.advanceWorkflow(
                                selectedProject.id,
                                currentStep.id,
                                user!.id,
                                false,
                                "審核不通過"
                              ).then(() => {
                                loadData()
                                projectService.getProjectById(selectedProject.id).then(updated => {
                                  if (updated) setSelectedProject(updated)
                                })
                              })
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          不成立
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Pending executions (competition mode) - only for approval type */}
                  {currentStep.type === "approval" && pendingExecutions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <History className="h-4 w-4" />
                        待驗收提交 ({pendingExecutions.length})
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {pendingExecutions.map((exec) => (
                          <Card key={exec.id} className="border-warning/50">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">
                                    {exec.executor?.name || "未知"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {exec.executedAt &&
                                      format(new Date(exec.executedAt), "MM/dd HH:mm", { locale: zhTW })}
                                  </p>
                                  {exec.content && (
                                    <p className="text-sm mt-1 line-clamp-2">{exec.content}</p>
                                  )}
                                  {exec.attachments.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <Paperclip className="h-3 w-3 inline mr-1" />
                                      {exec.attachments.length} 個附件
                                    </p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openVerifyDialog(exec)}
                                >
                                  驗收
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Workflow History */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <History className="h-4 w-4" />
                步驟明細
              </h3>
              <div className="space-y-3">
                {selectedProject.workflow
                  .filter(
                    (step, index) =>
                      step.status === "approved" ||
                      step.status === "rejected" ||
                      step.status === "not_established" ||
                      (step.status === "in_progress" && index === selectedProject.currentStep)
                  )
                  .map((step, _idx) => {
                    const originalIndex = selectedProject.workflow.indexOf(step)
                    const isRejected = step.status === "rejected" || step.status === "not_established"

                    return (
                      <Card
                        key={step.id}
                        className={cn(
                          isRejected && "border-destructive/50",
                          step.status === "in_progress" && "border-primary"
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                  step.status === "approved"
                                    ? "bg-primary text-primary-foreground"
                                    : isRejected
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-primary/20 text-primary"
                                )}
                              >
                                {step.status === "approved" ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : isRejected ? (
                                  <XCircle className="h-4 w-4" />
                                ) : (
                                  originalIndex + 1
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{step.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge
                                    variant={
                                      step.type === "approval" || step.type === "establishment"
                                        ? "warning"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {step.type === "approval"
                                      ? "審批"
                                      : step.type === "establishment"
                                      ? "成立審核"
                                      : "狀態"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant={
                                step.status === "approved"
                                  ? "success"
                                  : isRejected
                                  ? "destructive"
                                  : "warning"
                              }
                            >
                              {step.status === "approved"
                                ? "已通過"
                                : step.status === "rejected"
                                ? "已拒絕"
                                : step.status === "not_established"
                                ? "不成立"
                                : "進行中"}
                            </Badge>
                          </div>

                          {step.note && (
                            <div
                              className={cn(
                                "mt-3 p-2 rounded text-sm",
                                isRejected ? "bg-destructive/10" : "bg-muted/50"
                              )}
                            >
                              {step.note}
                            </div>
                          )}

                          {step.approvedAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(step.approvedAt), "yyyy/MM/dd HH:mm")}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            </div>

            {/* Project info */}
            <div className="text-xs text-muted-foreground text-center pt-4">
              建立於 {format(new Date(selectedProject.createdAt), "yyyy/MM/dd HH:mm")}
            </div>
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">計畫管理</h1>
          <p className="text-muted-foreground">管理計畫與專案流程</p>
        </div>
      </div>

      {/* Miller Columns Layout */}
      <Card className="h-[calc(100%-5rem)] overflow-hidden">
        {/* Desktop: Three columns */}
        <div className="hidden md:flex h-full">
          {/* Plans Column - 25% */}
          <div className="w-[25%]">
            <PlansColumn />
          </div>
          {/* Projects Column - 30% */}
          <div className="w-[30%]">
            <ProjectsColumn />
          </div>
          {/* Detail Column - 45% */}
          <div className="w-[45%]">
            <ProjectDetailColumn />
          </div>
        </div>

        {/* Mobile: Single column with view switching */}
        <div className="md:hidden h-full">
          {mobileView === "plans" && <PlansColumn />}
          {mobileView === "projects" && <ProjectsColumn />}
          {mobileView === "detail" && <ProjectDetailColumn />}
        </div>
      </Card>

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

            <Separator />

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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Assignee/Verifier settings for approval steps (雙角色) */}
                      {step.type === "approval" && (
                        <div className="grid grid-cols-2 gap-2 pl-1">
                          <div className="space-y-1">
                            <Label className="text-xs">執行人</Label>
                            <Select
                              value={step.assigneeTagId || ""}
                              onValueChange={(v) =>
                                updateStep(index, { assigneeTagId: v, assigneeType: "tag" })
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="選擇標籤" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">不限</SelectItem>
                                {adminTags.map((tag) => (
                                  <SelectItem key={tag.id} value={tag.id}>
                                    {tag.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">驗收人</Label>
                            <Select
                              value={step.verifierTagId || ""}
                              onValueChange={(v) =>
                                updateStep(index, { verifierTagId: v, verifierType: "tag" })
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="選擇標籤" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">不限</SelectItem>
                                {adminTags.map((tag) => (
                                  <SelectItem key={tag.id} value={tag.id}>
                                    {tag.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Approver setting for establishment steps (單一審核人) */}
                      {step.type === "establishment" && (
                        <div className="pl-1">
                          <div className="space-y-1">
                            <Label className="text-xs">審核人</Label>
                            <Select
                              value={step.approverTagId || ""}
                              onValueChange={(v) =>
                                updateStep(index, { approverTagId: v, approverType: "tag" })
                              }
                            >
                              <SelectTrigger className="h-8 w-48">
                                <SelectValue placeholder="選擇標籤" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">不限</SelectItem>
                                {adminTags.map((tag) => (
                                  <SelectItem key={tag.id} value={tag.id}>
                                    {tag.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

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

                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8 text-sm flex-1"
                            placeholder="輸入子任務名稱，按 Enter 新增"
                            value={subTaskInputs[index] || ""}
                            onChange={(e) =>
                              setSubTaskInputs({ ...subTaskInputs, [index]: e.target.value })
                            }
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

            <div className="space-y-2">
              <Label>關聯機構</Label>
              <Select
                value={projectFormData.organizationId}
                onValueChange={(v) =>
                  setProjectFormData({ ...projectFormData, organizationId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇機構（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">無</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Submit Execution Dialog */}
      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>提交執行內容</DialogTitle>
            <DialogDescription>
              填寫並提交此步驟的執行內容
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>執行內容</Label>
              <textarea
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={submitForm.content}
                onChange={(e) => setSubmitForm({ ...submitForm, content: e.target.value })}
                placeholder="描述執行結果..."
              />
            </div>

            <div className="space-y-2">
              <Label>附件</Label>
              <MultiImageUploader
                type="receipt"
                value={submitForm.attachments}
                onChange={(attachments) => setSubmitForm({ ...submitForm, attachments })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitExecution} disabled={isProcessing}>
              {isProcessing ? "提交中..." : "提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Execution Dialog */}
      <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>驗收提交內容</DialogTitle>
            <DialogDescription>
              審核 {selectedExecution?.executor?.name} 的提交
            </DialogDescription>
          </DialogHeader>

          {selectedExecution && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">提交內容</p>
                <p className="text-sm">{selectedExecution.content || "（無文字內容）"}</p>
                {selectedExecution.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedExecution.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-20 h-20 rounded overflow-hidden border hover:border-primary"
                      >
                        <img
                          src={att.thumbnailUrl || att.originalUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  提交於{" "}
                  {selectedExecution.executedAt &&
                    format(new Date(selectedExecution.executedAt), "yyyy/MM/dd HH:mm")}
                </p>
              </div>

              {!verifyForm.approved && (
                <div className="space-y-2">
                  <Label>退回原因 *</Label>
                  <textarea
                    className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={verifyForm.rejectReason}
                    onChange={(e) =>
                      setVerifyForm({ ...verifyForm, rejectReason: e.target.value })
                    }
                    placeholder="請說明退回原因..."
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVerifyDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setVerifyForm({ ...verifyForm, approved: false })
                if (verifyForm.rejectReason.trim()) {
                  handleVerifyExecution()
                }
              }}
              disabled={isProcessing}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              退回
            </Button>
            <Button
              onClick={() => {
                setVerifyForm({ ...verifyForm, approved: true })
                handleVerifyExecution()
              }}
              disabled={isProcessing}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              通過
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>流程範本</DialogTitle>
            <DialogDescription>此計畫的標準流程</DialogDescription>
          </DialogHeader>

          {viewingTemplateWorkflow && (
            <div className="py-4">
              <div className="flex items-center justify-center gap-2 flex-wrap py-4">
                {viewingTemplateWorkflow.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <span className="text-xs mt-1 text-center max-w-[50px]">
                        {step.name}
                      </span>
                    </div>
                    {index < viewingTemplateWorkflow.length - 1 && (
                      <Play className="h-3 w-3 text-muted-foreground/40" />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                {viewingTemplateWorkflow.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{step.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={step.type === "approval" || step.type === "establishment" ? "warning" : "secondary"}
                          className="text-xs"
                        >
                          {step.type === "approval" ? "審批" : step.type === "establishment" ? "成立審核" : "狀態"}
                        </Badge>
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

      {/* Plan View Dialog */}
      <Dialog open={isPlanViewOpen} onOpenChange={setIsPlanViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              {viewingPlan?.name}
            </DialogTitle>
            <DialogDescription>計畫詳情與對接機構</DialogDescription>
          </DialogHeader>

          {viewingPlan && (
            <div className="space-y-6">
              {/* Plan Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{viewingPlan.type}</Badge>
                  <Badge variant="outline">
                    {projects.filter(p => p.planId === viewingPlan.id).length} 專案
                  </Badge>
                </div>
                {viewingPlan.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingPlan.description}</p>
                )}
              </div>

              <Separator />

              {/* Workflow Preview */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  流程步驟
                </h3>
                <div className="flex items-center justify-center gap-2 flex-wrap py-4 bg-muted/30 rounded-lg">
                  {viewingPlan.workflow.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="text-xs mt-1 text-center max-w-[50px] leading-tight">
                          {step.name}
                        </span>
                      </div>
                      {index < viewingPlan.workflow.length - 1 && (
                        <Play className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Organizations */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  對接機構
                  <Badge variant="secondary">{viewingPlanOrgCount}</Badge>
                </h3>
                {isLoadingPlanView ? (
                  <div className="text-center text-muted-foreground py-4">載入中...</div>
                ) : viewingPlanOrgs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 bg-muted/30 rounded-lg">
                    尚無機構對接此計畫
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {viewingPlanOrgs.map(org => (
                      <div
                        key={org.id}
                        className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => {
                          setIsPlanViewOpen(false)
                          navigate(`/dashboard/organizations?org=${org.id}`)
                        }}
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{org.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanViewOpen(false)}>
              關閉
            </Button>
            <Button
              onClick={() => {
                setIsPlanViewOpen(false)
                if (viewingPlan) openPlanForm(viewingPlan)
              }}
            >
              <EditIcon className="h-4 w-4 mr-2" />
              編輯流程
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
