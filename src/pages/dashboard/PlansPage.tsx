import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
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
import { projectService, settingsService, organizationService, workflowService, userService, type ImageUploadResult } from "@/services"
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
  User,
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
  Send,
  RotateCcw,
  Bell,
  CalendarClock,
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
  const [staffMembers, setStaffMembers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Navigation state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>("plans")

  // Search state
  const [planSearch, setPlanSearch] = useState("")
  const [projectSearch, setProjectSearch] = useState("")
  const [showArchivedProjects, setShowArchivedProjects] = useState(false)
  const [showTrackingList, setShowTrackingList] = useState(false)

  // Preview state
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string; name: string } | null>(null)

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
  const [firstStepAttachments, setFirstStepAttachments] = useState<ImageUploadResult[]>([])

  // Check if selected plan's first step requires attachment
  const firstStepRequiresAttachment = (): boolean => {
    if (!selectedPlan || selectedPlan.workflow.length === 0) return false
    const firstStep = selectedPlan.workflow[0]
    // Check if step type is establishment or approval AND requires attachment
    const isApprovalType = firstStep.type === "establishment" || firstStep.type === "approval"
    return isApprovalType && firstStep.requireAttachment === true
  }

  const getFirstStepName = (): string => {
    if (!selectedPlan || selectedPlan.workflow.length === 0) return ""
    return selectedPlan.workflow[0].name
  }

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

  // Inline execution form content (using ref to avoid re-render/focus issues)
  const inlineExecContentRef = useRef<HTMLTextAreaElement>(null)
  const [inlineExecAttachments, setInlineExecAttachments] = useState<ImageUploadResult[]>([])

  // Ref for workflow progress scroll container
  const workflowScrollRef = useRef<HTMLDivElement>(null)
  const currentStepRef = useRef<HTMLDivElement>(null)

  // Edit mode for pending executions
  const [editingExecutionId, setEditingExecutionId] = useState<string | null>(null)
  const [_editExecContent, setEditExecContent] = useState("")
  const [editExecAttachments, setEditExecAttachments] = useState<ImageUploadResult[]>([])

  // Sub-tasks inline input (per step)
  const [subTaskInputs, setSubTaskInputs] = useState<Record<number, string>>({})
  const [subTaskAttachmentReq, setSubTaskAttachmentReq] = useState<Record<number, boolean>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [plansData, projectsData, templatesData, tagsData, typesData, orgsData, staffData] = await Promise.all([
        projectService.getPlans(),
        projectService.getProjects(),
        projectService.getWorkflowTemplates(),
        settingsService.getAdminTags(),
        projectService.getProjectTypes(),
        organizationService.getOrganizations(),
        userService.getAllStaff(),
      ])
      setPlans(plansData)
      setProjects(projectsData)
      setTemplates(templatesData)
      setAdminTags(tagsData)
      setProjectTypes(typesData)
      setOrganizations(orgsData)
      setStaffMembers(staffData)
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

  // Scroll workflow progress to center current step on mobile
  useEffect(() => {
    if (selectedProject && currentStepRef.current && workflowScrollRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        currentStepRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        })
      }, 100)
    }
  }, [selectedProject?.id, selectedProject?.currentStep])

  const loadProjectExecutions = async (projectId: string) => {
    setIsLoadingExecutions(true)
    try {
      const executions = await workflowService.getProjectExecutions(projectId)
      console.log("Loaded executions:", executions)
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
    // Deep copy plan to preserve original for comparison
    setEditingPlan(plan ? JSON.parse(JSON.stringify(plan)) : null)
    setPlanFormData({
      name: plan?.name || "",
      description: plan?.description || "",
      type: plan?.type || "",
    })
    // Deep copy workflow to avoid mutating the original
    setWorkflowSteps(
      plan?.workflow
        ? JSON.parse(JSON.stringify(plan.workflow))
        : [
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

  // Helper to extract template structure from workflow (ignoring execution state)
  const getWorkflowTemplate = (workflow: WorkflowStep[]) => {
    return workflow.map(step => ({
      id: step.id,
      name: step.name,
      type: step.type,
      assigneeType: step.assigneeType,
      assigneeTagId: step.assigneeTagId,
      assigneeUserIds: step.assigneeUserIds,
      verifierType: step.verifierType,
      verifierTagId: step.verifierTagId,
      verifierUserIds: step.verifierUserIds,
      approverType: step.approverType,
      approverTagId: step.approverTagId,
      approverUserIds: step.approverUserIds,
      requireAttachment: step.requireAttachment,
      subTasks: step.subTasks?.map(st => ({
        id: st.id,
        name: st.name,
        requireAttachment: st.requireAttachment,
        note: st.note,
      })),
    }))
  }

  // Project operations
  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    loadProjectExecutions(project.id)
    setMobileView("detail")
  }

  // Check if project workflow needs sync with plan
  const projectNeedsSync = (project: Project): boolean => {
    if (project.status !== "active") return false
    const plan = plans.find(p => p.id === project.planId)
    if (!plan) return false
    const projectTemplate = JSON.stringify(getWorkflowTemplate(project.workflow))
    const planTemplate = JSON.stringify(getWorkflowTemplate(plan.workflow))
    return projectTemplate !== planTemplate
  }

  // Sync project workflow with plan
  const handleSyncProjectWorkflow = async (project: Project) => {
    const plan = plans.find(p => p.id === project.planId)
    if (!plan) return

    const shouldSync = confirm(
      `確定要將此專案的流程同步至計畫「${plan.name}」的最新流程嗎？\n（已完成的步驟狀態會保留）`
    )

    if (!shouldSync) return

    // Merge new workflow structure while preserving execution state
    const updatedWorkflow = plan.workflow.map((newStep, idx) => {
      const existingStep = project.workflow.find(s => s.id === newStep.id) ||
                          project.workflow[idx]
      if (existingStep) {
        return {
          ...newStep,
          status: existingStep.status,
          currentRound: existingStep.currentRound,
          approvedBy: existingStep.approvedBy,
          approvedAt: existingStep.approvedAt,
          note: existingStep.note,
          attachments: existingStep.attachments,
          assigneeUserIds: existingStep.assigneeUserIds || newStep.assigneeUserIds,
          verifierUserIds: existingStep.verifierUserIds || newStep.verifierUserIds,
          approverUserIds: existingStep.approverUserIds || newStep.approverUserIds,
          subTasks: newStep.subTasks?.map((newSt, stIdx) => {
            const existingSt = existingStep.subTasks?.[stIdx]
            if (existingSt && existingSt.id === newSt.id) {
              return {
                ...newSt,
                completed: existingSt.completed,
                completedBy: existingSt.completedBy,
                completedAt: existingSt.completedAt,
                attachments: existingSt.attachments,
              }
            }
            return newSt
          }),
        }
      }
      return newStep
    })

    await projectService.updateProject(project.id, { workflow: updatedWorkflow })
    await loadData()

    const updated = await projectService.getProjectById(project.id)
    if (updated) {
      setSelectedProject(updated)
      loadProjectExecutions(updated.id)
    }
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
    setFirstStepAttachments([])  // Clear attachments when opening form
    setIsProjectFormOpen(true)
  }

  const handleSaveProject = async () => {
    if (!user || !selectedPlan) return

    if (!projectFormData.name) {
      alert("請填寫專案名稱")
      return
    }

    // Validate first step attachment if required
    if (!editingProject && firstStepRequiresAttachment() && firstStepAttachments.length === 0) {
      alert(`請上傳「${getFirstStepName()}」步驟所需的附件`)
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
        // Convert ImageUploadResult to ImageData for storage
        const attachmentsData: ImageData[] = firstStepAttachments.map((img) => ({
          id: img.id,
          originalUrl: img.originalUrl,
          thumbnailUrl: img.thumbnailUrl,
          fileName: img.fileName,
          fileSize: img.fileSize,
          mimeType: img.mimeType,
          order: img.order,
        }))

        // Initialize workflow with sub-tasks from plan
        const workflow: WorkflowStep[] = selectedPlan.workflow.map((step, index) => ({
          ...step,
          status: index === 0 ? "in_progress" : "pending",
          currentRound: 1,
          subTasks: step.subTasks?.map((st) => ({ ...st, completed: false })),
          // Add attachments to first step if required
          attachments: index === 0 && step.requireAttachment ? attachmentsData : step.attachments,
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

  const handleRestoreProject = async (project: Project) => {
    if (!confirm("確定要還原此專案嗎？專案將重置到第一步流程重新開始。")) return

    try {
      // Reset workflow to first step
      const resetWorkflow: WorkflowStep[] = project.workflow.map((step, index) => ({
        ...step,
        status: index === 0 ? "in_progress" : "pending",
        approvedBy: undefined,
        approvedAt: undefined,
        note: undefined,
        currentRound: 1,
        subTasks: step.subTasks?.map((st) => ({ ...st, completed: false, completedBy: undefined, completedAt: undefined })),
      }))

      await projectService.updateProject(project.id, {
        status: "active",
        workflow: resetWorkflow,
        currentStep: 0,
      })
      await loadData()
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
      }
      setShowArchivedProjects(false)
    } catch (error) {
      console.error("Failed to restore project:", error)
    }
  }

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`確定要永久刪除專案「${project.name}」嗎？此操作無法復原。`)) return

    try {
      await projectService.deleteProject(project.id)
      await loadData()
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
        setMobileView("projects")
      }
    } catch (error) {
      console.error("Failed to archive project:", error)
    }
  }

  // Tracking operations
  const handleCloseTracking = async (project: Project) => {
    if (!confirm("確定要關閉追蹤嗎？專案將移至封存。")) return

    try {
      await projectService.updateProject(project.id, {
        trackingEnabled: false,
        status: "archived",
      })
      await loadData()
    } catch (error) {
      console.error("Failed to close tracking:", error)
    }
  }

  const handleDismissTrackingNotification = async (project: Project) => {
    try {
      // Calculate next tracking date
      const nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + (project.trackingIntervalDays || 30))

      await projectService.updateProject(project.id, {
        trackingNotificationDismissed: true,
        nextTrackingDate: nextDate.toISOString(),
      })
      await loadData()
    } catch (error) {
      console.error("Failed to dismiss notification:", error)
    }
  }

  const handleEnableTracking = async (project: Project) => {
    const intervalStr = prompt("請輸入追蹤週期（天數）", "30")
    if (!intervalStr) return

    const intervalDays = parseInt(intervalStr, 10)
    if (isNaN(intervalDays) || intervalDays <= 0) {
      alert("請輸入有效的天數")
      return
    }

    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + intervalDays)

    try {
      await projectService.updateProject(project.id, {
        status: "completed",
        trackingEnabled: true,
        trackingIntervalDays: intervalDays,
        nextTrackingDate: nextDate.toISOString(),
        trackingNotificationDismissed: false,
      })
      await loadData()

      // Update selected project if it's the same
      if (selectedProject?.id === project.id) {
        const updated = await projectService.getProjectById(project.id)
        if (updated) setSelectedProject(updated)
      }
    } catch (error) {
      console.error("Failed to enable tracking:", error)
    }
  }

  // Workflow execution operations
  const handleSubmitExecution = async (overrideContent?: string) => {
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
          content: overrideContent ?? submitForm.content,
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

  // Update sub-task note
  const updateSubTaskNote = async (project: Project, stepIndex: number, subTaskId: string, note: string) => {
    const newWorkflow = [...project.workflow]
    const step = newWorkflow[stepIndex]
    const subTask = step.subTasks?.find((st) => st.id === subTaskId)

    if (subTask) {
      subTask.note = note

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

  // Update step attachments
  const updateStepAttachments = async (project: Project, stepIndex: number, attachments: ImageUploadResult[]) => {
    const newWorkflow = [...project.workflow]
    const step = newWorkflow[stepIndex]

    // Convert ImageUploadResult to ImageData
    const attachmentsData: ImageData[] = attachments.map((img) => ({
      id: img.id,
      originalUrl: img.originalUrl,
      thumbnailUrl: img.thumbnailUrl,
      fileName: img.fileName,
      fileSize: img.fileSize,
      mimeType: img.mimeType,
      order: img.order,
    }))

    step.attachments = attachmentsData

    await projectService.updateProject(project.id, { workflow: newWorkflow })
    await loadData()

    const updated = await projectService.getProjectById(project.id)
    if (updated) setSelectedProject(updated)
  }

  // Update step assignees (for super admin to assign specific people)
  const updateStepAssignees = async (
    project: Project,
    stepIndex: number,
    assigneeType: "assignee" | "verifier" | "approver",
    userIds: string[]
  ) => {
    const newWorkflow = [...project.workflow]
    const step = newWorkflow[stepIndex]

    if (assigneeType === "assignee") {
      step.assigneeUserIds = userIds.length > 0 ? userIds : undefined
      step.assigneeType = userIds.length > 0 ? "person" : undefined
    } else if (assigneeType === "verifier") {
      step.verifierUserIds = userIds.length > 0 ? userIds : undefined
      step.verifierType = userIds.length > 0 ? "person" : undefined
    } else if (assigneeType === "approver") {
      step.approverUserIds = userIds.length > 0 ? userIds : undefined
      step.approverType = userIds.length > 0 ? "person" : undefined
    }

    await projectService.updateProject(project.id, { workflow: newWorkflow })
    await loadData()

    const updated = await projectService.getProjectById(project.id)
    if (updated) setSelectedProject(updated)
  }

  // Helper to get user name by ID
  const getUserName = (userId: string) => {
    return staffMembers.find((s) => s.id === userId)?.name || userId
  }

  const advanceStatus = async (project: Project) => {
    if (!user) return

    const currentStep = project.workflow[project.currentStep]
    if (!currentStep) return

    if (!canAdvanceStep(currentStep)) {
      alert("請先完成所有子任務")
      return
    }

    // Check if current step is a tracking step (last step)
    if (currentStep.type === "tracking") {
      // Trigger tracking setup
      await handleEnableTracking(project)
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
        .filter((p) => {
          if (showTrackingList) {
            // Show completed projects with tracking enabled
            return p.status === "completed" && p.trackingEnabled
          }
          if (showArchivedProjects) {
            return p.status === "archived"
          }
          // Normal view: hide archived and completed+tracking projects
          return p.status !== "archived" && !(p.status === "completed" && p.trackingEnabled)
        })
        .filter((p) =>
          p.name.toLowerCase().includes(projectSearch.toLowerCase())
        )
    : []

  const archivedProjectCount = selectedPlan
    ? projects.filter((p) => p.planId === selectedPlan.id && p.status === "archived").length
    : 0

  const trackingProjectCount = selectedPlan
    ? projects.filter((p) => p.planId === selectedPlan.id && p.status === "completed" && p.trackingEnabled).length
    : 0

  // Projects that need tracking notification (tracking date has passed)
  const trackingDueProjects = selectedPlan
    ? projects.filter((p) =>
        p.planId === selectedPlan.id &&
        p.status === "completed" &&
        p.trackingEnabled &&
        p.nextTrackingDate &&
        new Date(p.nextTrackingDate) <= new Date() &&
        !p.trackingNotificationDismissed
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
              const projectCount = projects.filter((p) => p.planId === plan.id && p.status !== "archived").length
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
              {showTrackingList ? "追蹤清單" : showArchivedProjects ? "封存專案" : "專案"}
              {selectedPlan && (
                <span className="text-muted-foreground font-normal">- {selectedPlan.name}</span>
              )}
            </h2>
            {selectedPlan && (
              <div className="flex items-center gap-1">
                {/* Tracking list button */}
                <Button
                  variant={showTrackingList ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setShowTrackingList(!showTrackingList)
                    if (!showTrackingList) setShowArchivedProjects(false)
                  }}
                  title={showTrackingList ? "返回專案列表" : "查看追蹤清單"}
                  className="relative"
                >
                  <CalendarClock className="h-4 w-4" />
                  {trackingProjectCount > 0 && !showTrackingList && (
                    <span className="ml-1 text-xs">{trackingProjectCount}</span>
                  )}
                  {/* Notification dot for due tracking */}
                  {trackingDueProjects.length > 0 && !showTrackingList && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full animate-pulse" />
                  )}
                </Button>
                {/* Archived button */}
                <Button
                  variant={showArchivedProjects ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setShowArchivedProjects(!showArchivedProjects)
                    if (!showArchivedProjects) setShowTrackingList(false)
                  }}
                  title={showArchivedProjects ? "返回專案列表" : "查看封存專案"}
                >
                  <Archive className="h-4 w-4" />
                  {archivedProjectCount > 0 && !showArchivedProjects && (
                    <span className="ml-1 text-xs">{archivedProjectCount}</span>
                  )}
                </Button>
                {!showArchivedProjects && !showTrackingList && (
                  <Button size="sm" onClick={() => openProjectForm()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        {selectedPlan && (
          <>
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
            {projectSearch
              ? "無符合的專案"
              : showTrackingList
              ? "此計畫下無追蹤中的專案"
              : showArchivedProjects
              ? "此計畫下無封存專案"
              : "此計畫下尚無專案"}
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
                      {/* Desktop: name + type + description on same line */}
                      <div className="hidden md:flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{project.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {project.projectType}
                        </Badge>
                        {project.status === "not_established" && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            不成立
                          </Badge>
                        )}
                        {project.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {project.description}
                          </span>
                        )}
                      </div>
                      {/* Mobile: name + type, description on next line */}
                      <div className="md:hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{project.name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {project.projectType}
                          </Badge>
                          {project.status === "not_established" && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              不成立
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
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
                      {/* Archived project actions */}
                      {showArchivedProjects && project.status === "archived" && (
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRestoreProject(project)
                            }}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            還原
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProject(project)
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            刪除
                          </Button>
                        </div>
                      )}
                      {/* Tracking project info */}
                      {showTrackingList && project.trackingEnabled && (
                        <div className="mt-2 space-y-2">
                          {/* Tracking due notification */}
                          {project.nextTrackingDate && new Date(project.nextTrackingDate) <= new Date() && !project.trackingNotificationDismissed && (
                            <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded text-xs">
                              <Bell className="h-3 w-3 text-destructive animate-pulse" />
                              <span className="text-destructive font-medium">追蹤時間已到</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-xs ml-auto"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDismissTrackingNotification(project)
                                }}
                              >
                                關閉通知
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              <span>追蹤週期：每 {project.trackingIntervalDays} 天</span>
                              {project.nextTrackingDate && (
                                <span className="ml-2">
                                  下次追蹤：{new Date(project.nextTrackingDate).toLocaleDateString("zh-TW")}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCloseTracking(project)
                              }}
                            >
                              關閉追蹤
                            </Button>
                          </div>
                        </div>
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

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b">
          {/* Mobile back button */}
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
            <div className="flex-1">
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
            <div className="flex gap-1 items-center">
              {/* Sync button - only show when workflow differs from plan */}
              {projectNeedsSync(selectedProject) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSyncProjectWorkflow(selectedProject)}
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  title="流程與計畫不同，點擊同步"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  同步
                </Button>
              )}
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
              {/* Desktop close button */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex ml-2"
                onClick={() => setSelectedProject(null)}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Workflow Progress */}
            <div>
              <h3 className="font-medium mb-3">流程進度</h3>
              <div ref={workflowScrollRef} className="overflow-x-auto pb-2">
                <div className="flex gap-4 py-4 px-3 bg-muted/30 rounded-lg min-w-max items-start justify-center">
                  {selectedProject.workflow.map((step, index) => {
                    const hasSubTasks = step.subTasks && step.subTasks.length > 0
                    const subTasksCompleted = step.subTasks?.filter((st) => st.completed).length || 0
                    const totalSubTasks = step.subTasks?.length || 0
                    // 判斷是否為目前步驟：索引符合且狀態為 in_progress 或未設定狀態（向下相容舊資料）
                    const isCurrentStep = index === selectedProject.currentStep &&
                      (step.status === "in_progress" || !step.status || step.status === "pending" && index === 0)
                    const isInactive = step.status === "pending" && index !== selectedProject.currentStep

                    // Get approver/assignee info
                    // Get role info for display
                    const getStepRoleInfo = () => {
                      if (step.type === "establishment") {
                        // Show specific users if assigned, otherwise tag or 不限
                        const approver = step.approverUserIds?.length
                          ? step.approverUserIds.map(getUserName).join(", ")
                          : step.approverTagId
                            ? getTagName(step.approverTagId)
                            : "不限"
                        return { label: "審核", role: approver }
                      } else if (step.type === "approval") {
                        const executor = step.assigneeUserIds?.length
                          ? step.assigneeUserIds.map(getUserName).join(", ")
                          : step.assigneeTagId
                            ? getTagName(step.assigneeTagId)
                            : "不限"
                        const verifier = step.verifierUserIds?.length
                          ? step.verifierUserIds.map(getUserName).join(", ")
                          : step.verifierTagId
                            ? getTagName(step.verifierTagId)
                            : "不限"
                        return { label: "執行", role: executor, verifierLabel: "驗收", verifierRole: verifier }
                      } else if (step.type === "status") {
                        return { label: "負責", role: "不限" }
                      }
                      return null
                    }
                    const roleInfo = getStepRoleInfo()

                    // Get pending executions for this step
                    const stepPendingExecutions = stepExecutions.filter(
                      (e) => e.stepId === step.id && e.verificationStatus === "pending"
                    )
                    const hasPendingExecution = stepPendingExecutions.length > 0

                    // Check user roles for approval steps
                    const isExecutor = () => {
                      if (!user || step.type !== "approval") return false
                      // If specific users are assigned, only they can execute
                      if (step.assigneeUserIds && step.assigneeUserIds.length > 0) {
                        return step.assigneeUserIds.includes(user.id)
                      }
                      // Otherwise check tag or allow all (不限)
                      if (!step.assigneeTagId) return true // 不限
                      return user.adminTags?.includes(step.assigneeTagId)
                    }

                    const isVerifier = () => {
                      if (!user || step.type !== "approval") return false
                      // If specific users are assigned, only they can verify
                      if (step.verifierUserIds && step.verifierUserIds.length > 0) {
                        return step.verifierUserIds.includes(user.id)
                      }
                      // Otherwise check tag or allow all (不限)
                      if (!step.verifierTagId) return true // 不限
                      return user.adminTags?.includes(step.verifierTagId)
                    }

                    // Check if current user can approve this step
                    const canUserApprove = () => {
                      if (!user || !isCurrentStep) return false
                      if (step.type === "establishment") {
                        // If specific users are assigned, only they can approve
                        if (step.approverUserIds && step.approverUserIds.length > 0) {
                          return step.approverUserIds.includes(user.id)
                        }
                        if (!step.approverTagId) return true // 不限
                        return user.adminTags?.includes(step.approverTagId)
                      }
                      if (step.type === "approval") {
                        // Verifier can only approve after executor has submitted
                        if (hasPendingExecution && isVerifier()) return true
                        return false
                      }
                      // status 類型或未定義類型的步驟，任何人都可推進
                      return true
                    }

                    // Check if user can execute (submit work for approval steps)
                    const canUserExecute = () => {
                      if (!user || !isCurrentStep) return false
                      if (step.type !== "approval") return false
                      // Can execute if no pending execution from this user
                      // Multiple users can submit separately
                      const userHasPendingExecution = stepPendingExecutions.some(
                        (e) => e.executedBy === user.id
                      )
                      if (userHasPendingExecution) return false
                      return isExecutor()
                    }

                    const showApprovalButtons = canUserApprove() && selectedProject.status === "active"
                    const showExecuteButton = canUserExecute() && selectedProject.status === "active"

                    // Determine if node should be interactive
                    const hasRejectOption = step.type === "establishment" ||
                      (step.type === "approval" && hasPendingExecution)
                    const canReject = showApprovalButtons && hasRejectOption

                    return (
                      <div
                        key={step.id}
                        ref={isCurrentStep ? currentStepRef : undefined}
                        className="flex items-start gap-3"
                      >
                        <div
                          className={cn(
                            "flex flex-col items-center transition-all",
                            isCurrentStep ? "min-w-[70px]" : "min-w-[50px]",
                            isInactive && "opacity-50"
                          )}
                        >
                          {/* Step Circle - becomes button(s) when approval needed */}
                          <div className="relative">
                            {/* Non-interactive node (completed or waiting) */}
                            {!showApprovalButtons && (
                              <div
                                className={cn(
                                  "rounded-full flex items-center justify-center font-medium transition-all",
                                  isCurrentStep ? "w-12 h-12 text-base" : "w-9 h-9 text-sm",
                                  step.status === "approved"
                                    ? "bg-primary text-primary-foreground"
                                    : step.status === "in_progress"
                                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                    : step.status === "rejected" || step.status === "not_established"
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {step.status === "approved" ? (
                                  <CheckCircle className={isCurrentStep ? "h-6 w-6" : "h-4 w-4"} />
                                ) : step.status === "rejected" || step.status === "not_established" ? (
                                  <XCircle className={isCurrentStep ? "h-6 w-6" : "h-4 w-4"} />
                                ) : (
                                  index + 1
                                )}
                              </div>
                            )}

                            {/* Interactive node - split into left/right when both options available */}
                            {showApprovalButtons && canReject && (
                              <div className={cn(
                                "flex overflow-hidden",
                                isCurrentStep ? "w-12 h-12" : "w-9 h-9"
                              )}>
                                {/* Left half - Reject */}
                                <button
                                  className={cn(
                                    "flex-1 flex items-center justify-center bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-colors",
                                    isCurrentStep ? "rounded-l-full" : "rounded-l-full"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (step.type === "approval" && hasPendingExecution) {
                                      const reason = prompt("請輸入退回原因")
                                      if (reason) {
                                        workflowService.verifyExecution(
                                          stepPendingExecutions[0].id,
                                          user!.id,
                                          false,
                                          reason
                                        ).then(() => {
                                          loadData()
                                          loadProjectExecutions(selectedProject.id)
                                        })
                                      }
                                    } else if (step.type === "establishment") {
                                      if (confirm("確定要將此專案設為不成立嗎？")) {
                                        projectService.advanceWorkflow(
                                          selectedProject.id,
                                          step.id,
                                          user!.id,
                                          false,
                                          "不成立"
                                        ).then(() => {
                                          loadData()
                                          projectService.getProjectById(selectedProject.id).then((updated) => {
                                            if (updated) setSelectedProject(updated)
                                          })
                                        })
                                      }
                                    }
                                  }}
                                  title={step.type === "establishment" ? "不成立" : "退回"}
                                >
                                  <XCircle className={isCurrentStep ? "h-5 w-5" : "h-4 w-4"} />
                                </button>
                                {/* Right half - Approve */}
                                <button
                                  className={cn(
                                    "flex-1 flex items-center justify-center transition-colors",
                                    isCurrentStep ? "rounded-r-full" : "rounded-r-full",
                                    canAdvanceStep(step)
                                      ? "bg-green-500/80 hover:bg-green-500 text-white"
                                      : "bg-muted text-muted-foreground cursor-not-allowed"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!canAdvanceStep(step)) return
                                    if (step.type === "approval" && hasPendingExecution) {
                                      workflowService.verifyExecution(
                                        stepPendingExecutions[0].id,
                                        user!.id,
                                        true
                                      ).then(() => {
                                        projectService.advanceWorkflow(
                                          selectedProject.id,
                                          step.id,
                                          user!.id,
                                          true
                                        ).then(() => {
                                          loadData()
                                          projectService.getProjectById(selectedProject.id).then((updated) => {
                                            if (updated) {
                                              setSelectedProject(updated)
                                              loadProjectExecutions(updated.id)
                                            }
                                          })
                                        })
                                      })
                                    } else {
                                      advanceStatus(selectedProject)
                                    }
                                  }}
                                  disabled={!canAdvanceStep(step)}
                                  title="通過"
                                >
                                  <CheckCircle className={isCurrentStep ? "h-5 w-5" : "h-4 w-4"} />
                                </button>
                              </div>
                            )}

                            {/* Interactive node - only approve (status type) */}
                            {showApprovalButtons && !canReject && (
                              <button
                                className={cn(
                                  "rounded-full flex items-center justify-center font-medium transition-all",
                                  isCurrentStep ? "w-12 h-12 text-base" : "w-9 h-9 text-sm",
                                  canAdvanceStep(step)
                                    ? "bg-green-500/80 hover:bg-green-500 text-white"
                                    : "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (canAdvanceStep(step)) {
                                    advanceStatus(selectedProject)
                                  }
                                }}
                                disabled={!canAdvanceStep(step)}
                                title="通過"
                              >
                                <CheckCircle className={isCurrentStep ? "h-6 w-6" : "h-4 w-4"} />
                              </button>
                            )}

                            {/* Sub-tasks badge */}
                            {hasSubTasks && step.status !== "approved" && (
                              <span className={cn(
                                "absolute bg-warning text-warning-foreground rounded-full flex items-center justify-center z-10",
                                isCurrentStep ? "-bottom-1 -right-1 w-5 h-5 text-[10px]" : "-bottom-0.5 -right-0.5 w-4 h-4 text-[8px]"
                              )}>
                                {subTasksCompleted}/{totalSubTasks}
                              </span>
                            )}
                          </div>

                          {/* Step Name */}
                          <span className={cn(
                            "mt-2 text-center font-medium leading-tight",
                            isCurrentStep ? "text-sm" : "text-xs"
                          )}>
                            {step.name}
                          </span>

                          {/* Role Info */}
                          {roleInfo && (
                            <div className={cn(
                              "text-muted-foreground mt-0.5 text-center",
                              isCurrentStep ? "text-xs" : "text-[10px]"
                            )}>
                              <div>{roleInfo.label}：{roleInfo.role}</div>
                              {roleInfo.verifierLabel && (
                                <div>{roleInfo.verifierLabel}：{roleInfo.verifierRole}</div>
                              )}
                            </div>
                          )}

                          {/* Waiting for verification indicator (for non-verifiers) */}
                          {isCurrentStep && step.type === "approval" && hasPendingExecution && !showApprovalButtons && selectedProject.status === "active" && (
                            <p className="text-xs text-muted-foreground mt-1">等待驗收</p>
                          )}

                          {/* Waiting for execution indicator (for non-executors) */}
                          {isCurrentStep && step.type === "approval" && !hasPendingExecution && !showExecuteButton && selectedProject.status === "active" && (
                            <p className="text-xs text-muted-foreground mt-1">等待執行</p>
                          )}
                        </div>

                        {/* Arrow */}
                        {index < selectedProject.workflow.length - 1 && (
                          <div className={cn(
                            "flex items-center",
                            isCurrentStep ? "h-16" : "h-10"
                          )}>
                            <Play
                              className={cn(
                                isCurrentStep ? "h-5 w-5" : "h-3 w-3",
                                step.status === "approved"
                                  ? "text-primary"
                                  : "text-muted-foreground/40"
                              )}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 專案內容 - Document Style */}
            <Card>
                <CardContent className="p-0">
                  {selectedProject.workflow
                    .filter(
                      (step) => {
                        // Only show completed or in-progress steps
                        // Don't show pending steps
                        return (
                          step.status === "approved" ||
                          step.status === "rejected" ||
                          step.status === "not_established" ||
                          step.status === "in_progress"
                        )
                      }
                    )
                    .map((step, idx, filteredSteps) => {
                      const originalIndex = selectedProject.workflow.indexOf(step)
                      const isRejected = step.status === "rejected" || step.status === "not_established"
                      const hasSubTasks = step.subTasks && step.subTasks.length > 0
                      const canUpload = step.requireAttachment && step.type !== "approval" && (step.status === "in_progress" || step.status === "pending")
                      // Get executions for this step
                      const currentStepExecutions = stepExecutions.filter(e => e.stepId === step.id)
                      const pendingExecution = currentStepExecutions.find(e => e.verificationStatus === "pending")

                      // Check if user can edit this step content (sub-tasks, notes)
                      // For approved steps: only super_admin or originally assigned users
                      const canEditStep = () => {
                        if (!user) return false
                        if (user.role === "super_admin") return true
                        if (step.status === "approved" || step.status === "rejected" || step.status === "not_established") {
                          // Only assigned users can edit completed steps
                          if (step.assigneeUserIds?.includes(user.id)) return true
                          if (step.verifierUserIds?.includes(user.id)) return true
                          if (step.approverUserIds?.includes(user.id)) return true
                          return false
                        }
                        return true // Non-completed steps can be edited by anyone
                      }

                      // Check if this is current approval step and user can execute
                      const isCurrentApprovalStep = step.type === "approval" &&
                        originalIndex === selectedProject.currentStep &&
                        (step.status === "in_progress" || !step.status)
                      const userCanExecute = user && isCurrentApprovalStep && !pendingExecution && (
                        !step.assigneeTagId || user.adminTags?.includes(step.assigneeTagId)
                      )

                      const hasContent = (step.attachments && step.attachments.length > 0) || step.note || hasSubTasks || canUpload || currentStepExecutions.length > 0 || userCanExecute

                      return (
                        <div
                          key={step.id}
                          className={cn(
                            "p-4",
                            idx !== filteredSteps.length - 1 && "border-b"
                          )}
                        >
                          {/* Step Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                {originalIndex + 1}.
                              </span>
                              <span className="text-sm font-medium text-muted-foreground">{step.name}</span>
                              {/* Only show badge for non-approved steps */}
                              {step.status !== "approved" && (
                                <Badge
                                  variant={
                                    isRejected
                                      ? "destructive"
                                      : step.status === "in_progress"
                                      ? "warning"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {step.status === "rejected"
                                    ? "已拒絕"
                                    : step.status === "not_established"
                                    ? "不成立"
                                    : step.status === "in_progress"
                                    ? "進行中"
                                    : "待處理"}
                                </Badge>
                              )}
                              {/* Assignment display - editable for super_admin, read-only for others */}
                              {step.status === "in_progress" && user?.role === "super_admin" && (
                                <div className="flex items-center gap-2 ml-2 flex-wrap">
                                  {/* Executor Assignment for approval steps */}
                                  {step.type === "approval" && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground">執行:</span>
                                      {step.assigneeUserIds?.map((uid) => (
                                        <Badge key={uid} variant="secondary" className="text-xs h-5 gap-1">
                                          {getUserName(uid)}
                                          <button
                                            type="button"
                                            onClick={() => updateStepAssignees(
                                              selectedProject,
                                              originalIndex,
                                              "assignee",
                                              step.assigneeUserIds?.filter((id) => id !== uid) || []
                                            )}
                                            className="hover:text-destructive"
                                          >
                                            <XCircle className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      ))}
                                      <Select
                                        value=""
                                        onValueChange={(value) => {
                                          if (value) {
                                            updateStepAssignees(
                                              selectedProject,
                                              originalIndex,
                                              "assignee",
                                              [...(step.assigneeUserIds || []), value]
                                            )
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-5 text-xs w-16 px-1">
                                          <Plus className="h-3 w-3" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {staffMembers
                                            .filter((s) => !step.assigneeUserIds?.includes(s.id))
                                            .filter((s) => !step.assigneeTagId || s.adminTags?.includes(step.assigneeTagId))
                                            .map((staff) => (
                                              <SelectItem key={staff.id} value={staff.id} className="text-xs">
                                                {staff.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {/* Verifier Assignment for approval steps */}
                                  {step.type === "approval" && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground">驗收:</span>
                                      {step.verifierUserIds?.map((uid) => (
                                        <Badge key={uid} variant="secondary" className="text-xs h-5 gap-1">
                                          {getUserName(uid)}
                                          <button
                                            type="button"
                                            onClick={() => updateStepAssignees(
                                              selectedProject,
                                              originalIndex,
                                              "verifier",
                                              step.verifierUserIds?.filter((id) => id !== uid) || []
                                            )}
                                            className="hover:text-destructive"
                                          >
                                            <XCircle className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      ))}
                                      <Select
                                        value=""
                                        onValueChange={(value) => {
                                          if (value) {
                                            updateStepAssignees(
                                              selectedProject,
                                              originalIndex,
                                              "verifier",
                                              [...(step.verifierUserIds || []), value]
                                            )
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-5 text-xs w-16 px-1">
                                          <Plus className="h-3 w-3" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {staffMembers
                                            .filter((s) => !step.verifierUserIds?.includes(s.id))
                                            .filter((s) => !step.verifierTagId || s.adminTags?.includes(step.verifierTagId))
                                            .map((staff) => (
                                              <SelectItem key={staff.id} value={staff.id} className="text-xs">
                                                {staff.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {/* Approver Assignment for establishment steps */}
                                  {step.type === "establishment" && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground">審核:</span>
                                      {step.approverUserIds?.map((uid) => (
                                        <Badge key={uid} variant="secondary" className="text-xs h-5 gap-1">
                                          {getUserName(uid)}
                                          <button
                                            type="button"
                                            onClick={() => updateStepAssignees(
                                              selectedProject,
                                              originalIndex,
                                              "approver",
                                              step.approverUserIds?.filter((id) => id !== uid) || []
                                            )}
                                            className="hover:text-destructive"
                                          >
                                            <XCircle className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      ))}
                                      <Select
                                        value=""
                                        onValueChange={(value) => {
                                          if (value) {
                                            updateStepAssignees(
                                              selectedProject,
                                              originalIndex,
                                              "approver",
                                              [...(step.approverUserIds || []), value]
                                            )
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-5 text-xs w-16 px-1">
                                          <Plus className="h-3 w-3" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {staffMembers
                                            .filter((s) => !step.approverUserIds?.includes(s.id))
                                            .filter((s) => !step.approverTagId || s.adminTags?.includes(step.approverTagId))
                                            .map((staff) => (
                                              <SelectItem key={staff.id} value={staff.id} className="text-xs">
                                                {staff.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Read-only assignment display for non-super_admin */}
                              {step.status === "in_progress" && user?.role !== "super_admin" && (
                                <div className="flex items-center gap-2 ml-2 text-xs text-muted-foreground">
                                  {step.type === "approval" && (
                                    <>
                                      {(step.assigneeUserIds?.length || 0) > 0 && (
                                        <span>執行: {step.assigneeUserIds?.map(getUserName).join(", ")}</span>
                                      )}
                                      {(step.verifierUserIds?.length || 0) > 0 && (
                                        <span>驗收: {step.verifierUserIds?.map(getUserName).join(", ")}</span>
                                      )}
                                    </>
                                  )}
                                  {step.type === "establishment" && (step.approverUserIds?.length || 0) > 0 && (
                                    <span>審核: {step.approverUserIds?.map(getUserName).join(", ")}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {step.approvedAt && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(step.approvedAt), "yyyy/MM/dd")}
                              </span>
                            )}
                          </div>

                          {/* Content Area */}
                          {hasContent && (
                            <div className="space-y-3">
                              {/* Sub-tasks - Checkable list */}
                              {hasSubTasks && (
                                <div className="space-y-3">
                                  {step.subTasks!.map((subTask) => (
                                    <div
                                      key={subTask.id}
                                      className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        canEditStep() && "hover:bg-muted/50"
                                      )}
                                    >
                                      <label className={cn(
                                        "flex items-center gap-3",
                                        canEditStep() ? "cursor-pointer" : "cursor-default"
                                      )}>
                                        <Checkbox
                                          checked={subTask.completed}
                                          onCheckedChange={() => toggleSubTaskCompletion(selectedProject, originalIndex, subTask.id)}
                                          disabled={!canEditStep()}
                                        />
                                        <span className={cn(
                                          "text-sm flex-1",
                                          subTask.completed && "line-through text-muted-foreground"
                                        )}>
                                          {subTask.name}
                                          {subTask.requireAttachment && (
                                            <Paperclip className="inline-block h-3 w-3 ml-1 text-muted-foreground" />
                                          )}
                                        </span>
                                        {subTask.completed && subTask.completedAt && (
                                          <span className="text-xs text-muted-foreground">
                                            {format(new Date(subTask.completedAt), "MM/dd")}
                                          </span>
                                        )}
                                      </label>
                                      {canEditStep() ? (
                                        <div className="ml-8 mt-1">
                                          <Input
                                            placeholder="說明..."
                                            defaultValue={subTask.note || ""}
                                            className="text-xs h-7"
                                            onBlur={(e) => {
                                              const newNote = e.target.value
                                              if (newNote !== (subTask.note || "")) {
                                                updateSubTaskNote(selectedProject, originalIndex, subTask.id, newNote)
                                              }
                                            }}
                                          />
                                        </div>
                                      ) : subTask.note ? (
                                        <div className="ml-8 mt-1 text-xs text-muted-foreground">
                                          {subTask.note}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Text Note - Document Style */}
                              {step.note && (
                                <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap">
                                  {step.note}
                                </div>
                              )}

                              {/* Attachments - Horizontal Scroll */}
                              {step.attachments && step.attachments.length > 0 && (
                                <div className="overflow-x-auto pb-2">
                                  <div className="flex gap-4" style={{ minWidth: "min-content" }}>
                                    {step.attachments.map((attachment) => (
                                      <button
                                        key={attachment.id}
                                        type="button"
                                        onClick={() => setPreviewFile({
                                          url: attachment.originalUrl,
                                          type: attachment.mimeType,
                                          name: attachment.fileName
                                        })}
                                        className="group relative flex-shrink-0 w-60 h-60 rounded-lg overflow-hidden border bg-muted/30 hover:border-primary transition-colors flex items-center justify-center"
                                      >
                                        {attachment.mimeType === "application/pdf" ? (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2">
                                            <FileText className="h-16 w-16 mb-2 text-red-500" />
                                            <span className="text-sm truncate max-w-full text-center px-3">
                                              {attachment.fileName}
                                            </span>
                                          </div>
                                        ) : (
                                          <img
                                            src={attachment.thumbnailUrl || attachment.originalUrl}
                                            alt={attachment.fileName}
                                            className="max-w-full max-h-full object-contain"
                                          />
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                          <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Execution submissions for approval steps - horizontal scroll */}
                              {currentStepExecutions.length > 0 && (
                                <div className="overflow-x-auto pb-2">
                                  <div className="flex gap-4" style={{ minWidth: "min-content" }}>
                                  {currentStepExecutions.map((execution) => {
                                    const isEditing = editingExecutionId === execution.id
                                    // Can edit if: pending AND (super_admin OR original submitter)
                                    const canEdit = execution.verificationStatus === "pending" &&
                                      user && (user.role === "super_admin" || execution.executedBy === user.id)

                                    return (
                                      <div
                                        key={execution.id}
                                        className={cn(
                                          "border rounded-lg p-3 flex-shrink-0 w-80",
                                          execution.verificationStatus === "pending" && "border-warning bg-warning/5",
                                          execution.verificationStatus === "approved" && "border-green-500 bg-green-50",
                                          execution.verificationStatus === "rejected" && "border-destructive bg-destructive/5"
                                        )}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium">
                                              {execution.executor?.name || "執行人"}
                                            </span>
                                            <Badge
                                              variant={
                                                execution.verificationStatus === "pending"
                                                  ? "warning"
                                                  : execution.verificationStatus === "approved"
                                                  ? "success"
                                                  : "destructive"
                                              }
                                              className="text-xs"
                                            >
                                              {execution.verificationStatus === "pending"
                                                ? "待驗收"
                                                : execution.verificationStatus === "approved"
                                                ? "已通過"
                                                : "已退回"}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                              {execution.executedAt && format(new Date(execution.executedAt), "MM/dd HH:mm")}
                                            </span>
                                            {canEdit && !isEditing && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={() => {
                                                  setEditingExecutionId(execution.id)
                                                  setEditExecContent(execution.content || "")
                                                  setEditExecAttachments((execution.attachments || []).map(att => ({
                                                    id: att.id || `att-${Date.now()}`,
                                                    originalUrl: att.originalUrl,
                                                    thumbnailUrl: att.thumbnailUrl,
                                                    fileName: att.fileName,
                                                    fileSize: att.fileSize,
                                                    mimeType: att.mimeType,
                                                    order: att.order || 0,
                                                  })))
                                                }}
                                              >
                                                編輯
                                              </Button>
                                            )}
                                          </div>
                                        </div>

                                        {isEditing ? (
                                          <div className="space-y-3">
                                            <div>
                                              <Label className="text-xs text-muted-foreground">說明</Label>
                                              <textarea
                                                id={`edit-content-${execution.id}`}
                                                className="mt-1 flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                defaultValue={execution.content || ""}
                                                placeholder="填寫執行說明..."
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs text-muted-foreground">附件</Label>
                                              <div className="mt-1">
                                                <MultiImageUploader
                                                  type="receipt"
                                                  value={editExecAttachments}
                                                  onChange={setEditExecAttachments}
                                                />
                                              </div>
                                            </div>
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm"
                                                onClick={async () => {
                                                  const textarea = document.getElementById(`edit-content-${execution.id}`) as HTMLTextAreaElement
                                                  const content = textarea?.value || ""
                                                  console.log("Saving execution:", execution.id, "Content:", content, "Attachments:", editExecAttachments)
                                                  setIsProcessing(true)
                                                  try {
                                                    const result = await workflowService.updateExecution(
                                                      execution.id,
                                                      content,
                                                      editExecAttachments as ImageData[]
                                                    )
                                                    console.log("Update result:", result)
                                                    await loadProjectExecutions(selectedProject.id)
                                                    setEditingExecutionId(null)
                                                  } catch (error) {
                                                    console.error("Failed to update execution:", error)
                                                    alert("更新失敗: " + (error instanceof Error ? error.message : String(error)))
                                                  } finally {
                                                    setIsProcessing(false)
                                                  }
                                                }}
                                                disabled={isProcessing}
                                              >
                                                {isProcessing ? "儲存中..." : "儲存"}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setEditingExecutionId(null)}
                                              >
                                                取消
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            {execution.content && (
                                              <p className="text-sm mb-3 whitespace-pre-wrap">{execution.content}</p>
                                            )}
                                            {execution.attachments && execution.attachments.length > 0 && (
                                              <div className="flex gap-4 flex-wrap">
                                                {execution.attachments.map((att, attIdx) => (
                                                  <button
                                                    key={attIdx}
                                                    type="button"
                                                    onClick={() => setPreviewFile({
                                                      url: att.originalUrl,
                                                      type: att.mimeType,
                                                      name: att.fileName
                                                    })}
                                                    className="w-60 h-60 rounded-lg border overflow-hidden hover:border-primary transition-colors bg-muted/30 flex items-center justify-center"
                                                  >
                                                    {att.mimeType === "application/pdf" ? (
                                                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                                                        <FileText className="h-16 w-16 text-red-500 mb-2" />
                                                        <span className="text-sm text-muted-foreground truncate max-w-full px-3">
                                                          {att.fileName}
                                                        </span>
                                                      </div>
                                                    ) : (
                                                      <img
                                                        src={att.thumbnailUrl || att.originalUrl}
                                                        alt=""
                                                        className="max-w-full max-h-full object-contain"
                                                      />
                                                    )}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </>
                                        )}

                                        {execution.verificationStatus === "rejected" && execution.rejectReason && (
                                          <div className="mt-2 text-xs text-destructive">
                                            退回原因：{execution.rejectReason}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  </div>
                                </div>
                              )}

                              {/* Upload area for steps that require attachments (non-approval steps) */}
                              {canUpload && (
                                <div className="border-t pt-3 mt-3">
                                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                    <Paperclip className="h-3 w-3" />
                                    上傳附件
                                  </p>
                                  <MultiImageUploader
                                    type="receipt"
                                    value={(step.attachments || []).map(att => ({
                                      id: att.id,
                                      originalUrl: att.originalUrl,
                                      thumbnailUrl: att.thumbnailUrl,
                                      fileName: att.fileName,
                                      fileSize: att.fileSize,
                                      mimeType: att.mimeType,
                                      order: att.order,
                                    }))}
                                    onChange={(attachments) => updateStepAttachments(selectedProject, originalIndex, attachments)}
                                  />
                                </div>
                              )}

                              {/* Execution form for approval steps */}
                              {userCanExecute && selectedProject.status === "active" && (
                                <div key={`exec-form-${step.id}`} className="border-t pt-3 mt-3">
                                  <div className="space-y-3">
                                    <div>
                                      <Label className="text-xs text-muted-foreground">說明（選填）</Label>
                                      <textarea
                                        ref={inlineExecContentRef}
                                        className="mt-1 flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        defaultValue=""
                                        placeholder="填寫執行說明..."
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">附件</Label>
                                      <div className="mt-1">
                                        <MultiImageUploader
                                          type="receipt"
                                          value={inlineExecAttachments}
                                          onChange={setInlineExecAttachments}
                                        />
                                      </div>
                                    </div>
                                    <Button
                                      className="w-full"
                                      onClick={async () => {
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
                                              content: inlineExecContentRef.current?.value || "",
                                              attachments: inlineExecAttachments as ImageData[],
                                            }
                                          )
                                          await loadProjectExecutions(selectedProject.id)
                                          if (inlineExecContentRef.current) inlineExecContentRef.current.value = ""
                                          setInlineExecAttachments([])
                                          // Refresh project data
                                          const updated = await projectService.getProjectById(selectedProject.id)
                                          if (updated) setSelectedProject(updated)
                                        } catch (error) {
                                          console.error("Failed to submit execution:", error)
                                          alert("提交失敗，請稍後再試")
                                        } finally {
                                          setIsProcessing(false)
                                        }
                                      }}
                                      disabled={isProcessing}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      {isProcessing ? "送出中..." : "送出"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* No content placeholder */}
                          {!hasContent && (
                            <p className="text-sm text-muted-foreground italic">
                              尚無內容
                            </p>
                          )}
                        </div>
                      )
                    })}

                  {/* Empty state */}
                  {selectedProject.workflow.filter(
                    (step) =>
                      step.status === "approved" ||
                      step.status === "rejected" ||
                      step.status === "not_established" ||
                      step.status === "in_progress"
                  ).length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>尚無專案內容</p>
                    </div>
                  )}
                </CardContent>
              </Card>

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
        {/* Desktop: Two columns with sliding */}
        <div className="hidden md:flex h-full relative overflow-hidden">
          {/* Plans Column - slides out when detail is open */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out flex-shrink-0 border-r",
              selectedProject ? "w-0 opacity-0 overflow-hidden" : "w-[35%]"
            )}
          >
            <PlansColumn />
          </div>
          {/* Projects Column - always visible */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out flex-shrink-0 border-r",
              selectedProject ? "w-[30%]" : "w-[65%]"
            )}
          >
            <ProjectsColumn />
          </div>
          {/* Detail Column - slides in when project selected */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out flex-shrink-0",
              selectedProject ? "w-[70%]" : "w-0 opacity-0 overflow-hidden"
            )}
          >
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
                            <SelectItem value="tracking">追蹤</SelectItem>
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

            {/* First step attachment upload (only show when creating and first step requires attachment) */}
            {!editingProject && firstStepRequiresAttachment() && (
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <Label className="flex items-center gap-2 text-base">
                  <Paperclip className="h-4 w-4" />
                  {getFirstStepName()} - 附件上傳 *
                  <Badge variant="warning" className="text-xs">
                    {selectedPlan?.workflow[0]?.type === "establishment" ? "成立審核" : "審批"}
                  </Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  此步驟需要上傳附件文件（支援圖片及 PDF）
                </p>
                <MultiImageUploader
                  type="receipt"
                  value={firstStepAttachments}
                  onChange={setFirstStepAttachments}
                />
              </div>
            )}
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
            <Button onClick={() => handleSubmitExecution()} disabled={isProcessing}>
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
                          variant={step.type === "approval" || step.type === "establishment" ? "warning" : step.type === "tracking" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {step.type === "approval" ? "審批" : step.type === "establishment" ? "成立審核" : step.type === "tracking" ? "追蹤" : "狀態"}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                    {projects.filter(p => p.planId === viewingPlan.id && p.status !== "archived").length} 專案
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
                <div className="flex items-center justify-center gap-4 py-4 bg-muted/30 rounded-lg overflow-x-auto">
                  {viewingPlan.workflow.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="text-xs mt-1 text-center max-w-[60px] leading-tight">
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

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2 truncate pr-8">
              {previewFile?.type === "application/pdf" ? (
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <Eye className="h-5 w-5 shrink-0" />
              )}
              <span className="truncate">{previewFile?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30">
            {previewFile?.type === "application/pdf" ? (
              <iframe
                src={previewFile.url}
                className="w-full h-[calc(90vh-8rem)]"
                title={previewFile.name}
              />
            ) : (
              <div className="flex items-center justify-center p-4 min-h-[50vh]">
                <img
                  src={previewFile?.url}
                  alt={previewFile?.name}
                  className="max-w-full max-h-[calc(90vh-10rem)] object-contain"
                />
              </div>
            )}
          </div>
          <div className="p-3 border-t flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewFile(null)}
            >
              關閉
            </Button>
            <Button
              variant="secondary"
              size="sm"
              asChild
            >
              <a
                href={previewFile?.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                新分頁開啟
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
