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
import { MultiImageUploader, StaticPDFInput, StaticMultiPDFInput, PDFPageViewer, DropZone, type StaticPDFData } from "@/components/upload"
import { imageService, validateFile } from "@/services/imageService"
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
  Check,
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
  CalendarClock,
  LayoutGrid,
  Columns,
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
  const [_projectTypes, setProjectTypes] = useState<ProjectType[]>([])
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

  // View mode state
  const [viewMode, setViewMode] = useState<'card' | 'flow' | 'tracking'>('card')

  // Tracking calendar state
  const [trackingMonth, setTrackingMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [trackingEventPopup, setTrackingEventPopup] = useState<{
    isOpen: boolean
    date: number
    type: 'committee' | 'oneTime' | 'periodic'
    title: string
    projects: Project[]
  } | null>(null)

  // Flow view project modal state
  const [flowProjectModal, setFlowProjectModal] = useState<Project | null>(null)

  // Payment tracking checkboxes state
  const [checkedPayments, setCheckedPayments] = useState<Set<string>>(new Set())

  // Ref for project detail scroll container
  const projectDetailScrollRef = useRef<HTMLDivElement>(null)
  // Ref to save scroll position before opening dialogs
  const savedScrollPositionRef = useRef<number>(0)
  // Ref to save scroll position for step editing

  // Clear flowProjectModal when selectedProject is cleared or viewMode changes
  useEffect(() => {
    if (!selectedProject || viewMode !== 'flow') {
      setFlowProjectModal(null)
    }
  }, [selectedProject, viewMode])

  // ESC key to close flow project modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && flowProjectModal) {
        setFlowProjectModal(null)
        setSelectedProject(null)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [flowProjectModal])

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
    code: "",  // 計畫英文代號
    // 公開設定
    isPublic: false,
    cardDescription: "",
    publicDescription: "",
    coverImage: null as ImageData | null,
    introPdf: null as StaticPDFData | null,
    downloadPdfs: [] as StaticPDFData[],
  })
  // 計畫表單的編輯模式：'intro' | 'workflow'
  const [planFormMode, setPlanFormMode] = useState<'basic' | 'intro' | 'workflow'>('basic')
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
    sourceType: "個人" as "個人" | "機構" | "董事",
    projectNumber: "",  // 個案編號
    planId: "",  // 計畫ID（流程模式新增時使用）
  })
  const [firstStepAttachments, setFirstStepAttachments] = useState<ImageUploadResult[]>([])

  // Check if selected plan's first step requires attachment
  const firstStepRequiresAttachment = (): boolean => {
    const targetPlan = selectedPlan || plans.find(p => p.id === projectFormData.planId)
    if (!targetPlan || targetPlan.workflow.length === 0) return false
    const firstStep = targetPlan.workflow[0]
    // Check if step type is establishment or approval AND requires attachment
    const isApprovalType = firstStep.type === "establishment" || firstStep.type === "approval"
    return isApprovalType && firstStep.requireAttachment === true
  }

  const getFirstStepName = (): string => {
    const targetPlan = selectedPlan || plans.find(p => p.id === projectFormData.planId)
    if (!targetPlan || targetPlan.workflow.length === 0) return ""
    return targetPlan.workflow[0].name
  }

  const getTargetPlanForForm = () => {
    return selectedPlan || plans.find(p => p.id === projectFormData.planId)
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
  const [reviewResult, setReviewResult] = useState<Record<string, 'approved' | 'rejected' | ''>>({})

  // 評議委員會表單
  const [committeeForm, setCommitteeForm] = useState<{
    meetingDate: string
    purposes: string[]  // 補助用途：急難救助, 醫療補助, 教育扶助, 喪葬補助, 生活扶助
    subsidyType: 'oneTime' | 'periodic' | ''  // 一次性 or 期間性
    oneTimeMonth: string  // 一次性補助月份
    oneTimeAmount: string  // 一次性補助金額
    periodStart: string  // 補助期間開始
    periodEnd: string  // 補助期間結束
    frequency: 'monthly' | 'periodic' | ''  // 每月 or 每幾月
    periodicMonths: string  // 每__月為一期
    periodicAmount: string  // 每期金額
  }>({
    meetingDate: '',
    purposes: [],
    subsidyType: '',
    oneTimeMonth: '',
    oneTimeAmount: '',
    periodStart: '',
    periodEnd: '',
    frequency: '',
    periodicMonths: '',
    periodicAmount: '',
  })
  const [committeeAttachments, setCommitteeAttachments] = useState<ImageUploadResult[]>([])

  // 結案與追蹤表單
  const [closingForm, setClosingForm] = useState<{
    paymentDate: string  // 一次性匯款日期
    trackingDates: { date: string; completed: boolean }[]  // 追蹤日期列表
  }>({
    paymentDate: '',
    trackingDates: [],
  })
  const [closingAttachments, setClosingAttachments] = useState<ImageUploadResult[]>([])

  // Inline execution form content (using ref to avoid re-render/focus issues)
  const inlineExecContentRef = useRef<HTMLTextAreaElement>(null)
  const [inlineExecAttachments, setInlineExecAttachments] = useState<ImageUploadResult[]>([])


  // Edit mode for pending executions
  const [editingExecutionId, setEditingExecutionId] = useState<string | null>(null)
  // Edit mode for completed steps (track which step is being edited)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
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

  const openPlanForm = (plan?: Plan, mode: 'intro' | 'workflow' = 'intro') => {
    // Deep copy plan to preserve original for comparison
    setEditingPlan(plan ? JSON.parse(JSON.stringify(plan)) : null)
    setPlanFormData({
      name: plan?.name || "",
      description: plan?.description || "",
      type: plan?.type || "",
      code: plan?.code || "",  // 計畫英文代號
      // 公開設定
      isPublic: plan?.isPublic || false,
      cardDescription: plan?.cardDescription || "",
      publicDescription: plan?.publicDescription || "",
      coverImage: plan?.coverImage || null,
      introPdf: plan?.introPdf || null,
      downloadPdfs: plan?.downloadPdfs || [],
    })
    // Deep copy workflow to avoid mutating the original
    setWorkflowSteps(
      plan?.workflow
        ? JSON.parse(JSON.stringify(plan.workflow))
        : [
            { id: "step-1", name: "提案", type: "status" },
            { id: "step-2", name: "審核", type: "approval" },
            { id: "step-3", name: "執行中", type: "status" },
            { id: "step-4", name: "結案與追蹤", type: "status" },
          ]
    )
    setSelectedTemplate("")
    setPlanFormMode(mode)
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
        code: planFormData.code || undefined,  // 計畫英文代號
        workflow: workflowSteps,
        status: "active" as const,
        createdBy: user.id,
        // 公開設定
        isPublic: planFormData.isPublic,
        cardDescription: planFormData.cardDescription,
        publicDescription: planFormData.publicDescription,
        coverImage: planFormData.coverImage || undefined,
        introPdf: planFormData.introPdf || undefined,
        downloadPdfs: planFormData.downloadPdfs,
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
      `確定要將此個案的流程同步至計畫「${plan.name}」的最新流程嗎？\n（已完成的步驟狀態會保留）`
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
    // Determine source type from description field
    let sourceType: "個人" | "機構" | "董事" = "個人"
    if (project?.description === "機構" || project?.description === "董事") {
      sourceType = project.description
    } else if (project?.organizationId) {
      sourceType = "機構"
    }
    // Generate default project number: [Plan Code][ROC Year][Month][Sequential]
    // Example: AB11509001 (AB計畫, 民國115年, 9月, 第001號)
    const now = new Date()
    const rocYear = now.getFullYear() - 1911  // 民國年
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = selectedPlan?.code ? `${selectedPlan.code}${rocYear}${month}` : ""

    // Find next sequential number based on existing projects
    let nextSeq = 1
    if (prefix && projects.length > 0) {
      const existingNumbers = projects
        .filter(p => p.projectNumber?.startsWith(prefix))
        .map(p => {
          const seq = p.projectNumber?.slice(prefix.length)
          return seq ? parseInt(seq) : 0
        })
        .filter(n => !isNaN(n))
      if (existingNumbers.length > 0) {
        nextSeq = Math.max(...existingNumbers) + 1
      }
    }
    const defaultProjectNumber = prefix ? `${prefix}${String(nextSeq).padStart(3, '0')}` : ""

    setProjectFormData({
      name: project?.name || "",
      description: project?.description || "",
      projectType: project?.projectType || "",
      budgetAmount: project?.budgetAmount || 0,
      organizationId: project?.organizationId || "",
      sourceType,
      projectNumber: project?.projectNumber || defaultProjectNumber,
      planId: project?.planId || "",  // Reset planId for new project
    })
    setFirstStepAttachments([])  // Clear attachments when opening form
    setIsProjectFormOpen(true)
  }

  const handleSaveProject = async () => {
    if (!user) return

    // Get the target plan - either selectedPlan or from form's planId
    const targetPlan = selectedPlan || plans.find(p => p.id === projectFormData.planId)

    if (!targetPlan) {
      alert("請選擇計畫")
      return
    }

    if (!projectFormData.name) {
      alert("請填寫個案名稱")
      return
    }

    // Validate organization when source type is "機構"
    if (projectFormData.sourceType === "機構" && !projectFormData.organizationId) {
      alert("請選擇關聯機構")
      return
    }

    // 附件可以後續補上傳，不強制要求

    // Only require organization when source type is "機構"
    const organizationId = projectFormData.sourceType === "機構" ? projectFormData.organizationId : undefined

    setIsSavingProject(true)
    try {
      if (editingProject) {
        await projectService.updateProject(editingProject.id, {
          name: projectFormData.name,
          description: projectFormData.sourceType,  // 來源存到 description
          projectType: projectFormData.projectType,
          projectNumber: projectFormData.projectNumber || undefined,
          budgetAmount: 0,
          organizationId,
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

        // 機構/董事 自動跳過初步篩選（第1步）
        const skipScreening = projectFormData.sourceType === "機構" || projectFormData.sourceType === "董事"
        const startStep = skipScreening ? 1 : 0  // 機構/董事從第2步開始，個人從第1步開始

        // Initialize workflow with sub-tasks from plan
        const workflow: WorkflowStep[] = targetPlan.workflow.map((step, index) => {
          // 決定每個步驟的狀態
          let stepStatus: "pending" | "in_progress" | "approved" = "pending"
          let approvedAt: string | undefined = undefined

          if (index === 0) {
            // 第1步（審核）：機構/董事自動通過，個人需要審核
            if (skipScreening) {
              stepStatus = "approved"
              approvedAt = new Date().toISOString()
            } else {
              stepStatus = "in_progress"
            }
          } else if (index === startStep) {
            // 當前進行的步驟
            stepStatus = "in_progress"
          }

          return {
            ...step,
            status: stepStatus,
            approvedAt,
            currentRound: 1,
            subTasks: step.subTasks?.map((st) => ({
              ...st,
              completed: false,
            })),
            // Add attachments to first step if required
            attachments: index === 0 && step.requireAttachment ? attachmentsData : step.attachments,
          }
        })

        await projectService.createProject({
          planId: targetPlan.id,
          organizationId,
          name: projectFormData.name,
          description: projectFormData.sourceType,  // 來源存到 description
          projectType: projectFormData.projectType || "一般",
          projectNumber: projectFormData.projectNumber || undefined,
          budgetAmount: 0,
          workflow,
          currentStep: startStep,
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
    if (!confirm("確定要封存此個案嗎？")) return

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
    if (!confirm("確定要還原此個案嗎？個案將重置到第一步流程重新開始。")) return

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
    if (!confirm(`確定要永久刪除個案「${project.name}」嗎？此操作無法復原。`)) return

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

  // Sub-task completion (optimistic update)
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

      // 樂觀更新 UI - 立即更新本地狀態
      setSelectedProject({ ...project, workflow: newWorkflow })
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, workflow: newWorkflow } : p))

      // 背景同步到 Supabase（不阻塞 UI）
      projectService.updateProject(project.id, { workflow: newWorkflow }).catch(err => {
        console.error("Failed to sync subtask:", err)
      })
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

  // Update step attachments with ImageData directly
  const handleUpdateStepAttachments = async (project: Project, stepIndex: number, attachments: ImageData[]) => {
    const newWorkflow = [...project.workflow]
    const step = newWorkflow[stepIndex]
    step.attachments = attachments

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
          if (showArchivedProjects) {
            return p.status === "archived"
          }
          // Normal view: hide archived projects
          return p.status !== "archived"
        })
        .filter((p) =>
          p.name.toLowerCase().includes(projectSearch.toLowerCase())
        )
    : []

  const archivedProjectCount = selectedPlan
    ? projects.filter((p) => p.planId === selectedPlan.id && p.status === "archived").length
    : 0


  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center text-muted-foreground">載入中...</div>
      </div>
    )
  }

  // 定義統一的流程步驟名稱
  const workflowStepNames = ['審核', '評估表', '評議委員會', '文件寄發及簽核', '結案與追蹤']

  // Plans Cards Component (Top Section) - Only shows when no plan is selected
  const PlansCards = () => {
    // 取得所有進行中的個案，按步驟分組
    const activeProjects = projects.filter(p => p.status === 'active')
    const completedProjects = projects.filter(p => p.status === 'completed')

    // 按當前步驟分組個案
    const getProjectsByStep = (stepName: string) => {
      return activeProjects.filter(p => {
        const currentStepObj = p.workflow[p.currentStep]
        return currentStepObj?.name?.includes(stepName.replace('及簽核', '').replace('與追蹤', ''))
      })
    }

    return (
      <div className="p-2 md:p-4 md:flex-1 md:overflow-x-auto md:overflow-y-auto min-w-0 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 md:mb-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋計畫..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="pl-9 h-8 md:h-9 w-full sm:w-40 md:w-48 text-sm"
              />
            </div>
            {/* View mode toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden flex-shrink-0">
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 md:h-9 px-2 md:px-3"
                onClick={() => setViewMode('card')}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">卡片</span>
              </Button>
              <Button
                variant={viewMode === 'flow' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 md:h-9 px-2 md:px-3"
                onClick={() => setViewMode('flow')}
              >
                <Columns className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">流程</span>
              </Button>
              <Button
                variant={viewMode === 'tracking' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 md:h-9 px-2 md:px-3"
                onClick={() => setViewMode('tracking')}
              >
                <CalendarClock className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">追蹤</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Card View */}
        {viewMode === 'card' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-6">
                {filteredPlans.map((plan) => {
                  const projectCount = projects.filter((p) => p.planId === plan.id && p.status !== "archived").length
                  const activeCount = projects.filter((p) => p.planId === plan.id && p.status === "active").length

                  return (
                    <div
                      key={plan.id}
                      className="rounded-lg overflow-hidden cursor-pointer transition-all border bg-card hover:shadow-lg hover:border-primary/50 flex flex-col aspect-[3/4]"
                      onClick={() => handleSelectPlan(plan)}
                    >
                      {/* Cover Image - only 33% height */}
                      <div className="h-1/3 bg-muted shrink-0">
                        {plan.coverImage ? (
                          <img
                            src={plan.coverImage.thumbnailUrl || plan.coverImage.originalUrl}
                            alt={plan.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FolderKanban className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      {/* Content - 67% height */}
                      <div className="p-3 flex-1 flex flex-col min-h-0">
                        {/* Title + Badge */}
                        <div className="flex items-start gap-1.5">
                          <h3 className="font-semibold text-sm line-clamp-1 flex-1">{plan.name}</h3>
                          {activeCount > 0 && (
                            <Badge variant="default" className="text-[10px] px-1 py-0 shrink-0">
                              {activeCount}
                            </Badge>
                          )}
                        </div>
                        {/* Description */}
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-4 flex-1 whitespace-pre-line">
                          {plan.description || "無描述"}
                        </p>
                        {/* Desktop: Project stats */}
                        <p className="hidden md:block text-xs text-muted-foreground mb-2">
                          {activeCount} 進行中 · 共 {projectCount} 個案
                        </p>
                        {/* View button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            openPlanView(plan)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看計畫
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {/* 新增計畫卡片 */}
                <div
                  className="rounded-lg overflow-hidden cursor-pointer transition-all border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 flex flex-col aspect-[3/4] items-center justify-center"
                  onClick={() => openPlanForm()}
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-muted-foreground">新增計畫</span>
                </div>
              </div>
        )}

        {/* Flow View - Kanban style by workflow steps */}
        {viewMode === 'flow' && (
          <div className="flex gap-2 md:gap-4 overflow-x-auto md:overflow-visible pb-4 min-w-0 w-full min-h-[50vh]" style={{ WebkitOverflowScrolling: 'touch' }}>
            {workflowStepNames.map((stepName, stepIdx) => {
              const stepProjects = getProjectsByStep(stepName)
              return (
                <div
                  key={stepName}
                  className="flex-shrink-0 w-40 sm:w-56 md:flex-1 md:flex-shrink md:min-w-0 bg-muted/30 rounded-lg flex flex-col max-h-[calc(100vh-180px)] md:max-h-[calc(100vh-200px)]"
                >
                  {/* Column Header */}
                  <div className="p-2 md:p-3 border-b bg-muted/50 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 md:gap-2">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] md:text-xs font-bold">
                          {stepIdx + 1}
                        </div>
                        <span className="font-medium text-xs md:text-sm truncate">{stepName}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] md:text-xs">
                        {stepProjects.length}
                      </Badge>
                    </div>
                  </div>
                  {/* Column Content */}
                  <div className="flex-1 p-1.5 md:p-2 space-y-1.5 md:space-y-2 overflow-y-auto">
                    {/* Add Project Button - only in 審核 column */}
                    {stepIdx === 0 && (
                      <div
                        className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-2 md:p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all flex items-center justify-center gap-1 md:gap-2 text-muted-foreground"
                        onClick={() => openProjectForm()}
                      >
                        <Plus className="h-3 w-3 md:h-4 md:w-4" />
                        <span className="text-xs md:text-sm">新增個案</span>
                      </div>
                    )}
                    {stepProjects.length === 0 && stepIdx !== 0 ? (
                      <div className="text-center text-muted-foreground text-xs py-4">
                        無個案
                      </div>
                    ) : (
                      stepProjects.map((project) => {
                        const plan = plans.find(p => p.id === project.planId)
                        const org = organizations.find(o => o.id === project.organizationId)
                        return (
                          <div
                            key={project.id}
                            className="bg-card border rounded-lg p-2 md:p-3 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
                            onClick={() => {
                              setFlowProjectModal(project)
                              setSelectedProject(project)
                            }}
                          >
                            <div className="font-medium text-xs md:text-sm line-clamp-1">{project.name}</div>
                            {org && (
                              <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 flex items-center gap-1 line-clamp-1">
                                <Building2 className="h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                                <span className="truncate">{org.name}</span>
                              </div>
                            )}
                            {plan && (
                              <Badge variant="outline" className="text-[10px] md:text-xs mt-1 md:mt-2 hidden sm:inline-flex">
                                {plan.name}
                              </Badge>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
            {/* Completed Column */}
            <div className="flex-shrink-0 w-40 sm:w-56 md:flex-1 md:flex-shrink md:min-w-0 bg-green-50 dark:bg-green-950/20 rounded-lg flex flex-col max-h-[calc(100vh-180px)] md:max-h-[calc(100vh-200px)]">
              <div className="p-2 md:p-3 border-b bg-green-100 dark:bg-green-900/30 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 md:gap-2">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-green-600 text-white flex items-center justify-center">
                      <Check className="h-3 w-3 md:h-4 md:w-4" />
                    </div>
                    <span className="font-medium text-xs md:text-sm">已完成</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] md:text-xs bg-green-200 dark:bg-green-800">
                    {completedProjects.length}
                  </Badge>
                </div>
              </div>
              <div className="flex-1 p-1.5 md:p-2 space-y-1.5 md:space-y-2 overflow-y-auto">
                {completedProjects.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs py-4">
                    無個案
                  </div>
                ) : (
                  completedProjects.slice(0, 10).map((project) => {
                    const plan = plans.find(p => p.id === project.planId)
                    const org = organizations.find(o => o.id === project.organizationId)
                    return (
                      <div
                        key={project.id}
                        className="bg-card border border-green-200 dark:border-green-800 rounded-lg p-2 md:p-3 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => {
                          setFlowProjectModal(project)
                          setSelectedProject(project)
                        }}
                      >
                        <div className="font-medium text-xs md:text-sm line-clamp-1">{project.name}</div>
                        {org && (
                          <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 flex items-center gap-1 line-clamp-1">
                            <Building2 className="h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                            <span className="truncate">{org.name}</span>
                          </div>
                        )}
                        {plan && (
                          <Badge variant="outline" className="text-[10px] md:text-xs mt-1 md:mt-2 border-green-300 hidden sm:inline-flex">
                            {plan.name}
                          </Badge>
                        )}
                      </div>
                    )
                  })
                )}
                {completedProjects.length > 10 && (
                  <div className="text-center text-muted-foreground text-xs py-2">
                    +{completedProjects.length - 10} 更多
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tracking View - 左側清單 + 右側行事曆 */}
        {viewMode === 'tracking' && (
          (() => {
            const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
            const currentMonthStr = `${trackingMonth.year}-${String(trackingMonth.month + 1).padStart(2, '0')}`

            // 取得當月第一天和最後一天
            const firstDay = new Date(trackingMonth.year, trackingMonth.month, 1)
            const lastDay = new Date(trackingMonth.year, trackingMonth.month + 1, 0)
            const daysInMonth = lastDay.getDate()
            const startDayOfWeek = firstDay.getDay() // 0 = Sunday

            // 收集當月的事件（按日期和類型分組）
            const monthEvents: { date: number; type: 'committee' | 'oneTime' | 'periodic'; project: Project }[] = []

            // 收集當月匯款清單
            const oneTimePayments: { project: Project; amount: number; org: string; date: number }[] = []
            const periodicPayments: { project: Project; amount: number; org: string; frequency: string }[] = []

            // 評議委員會個案清單
            const committeeProjects: { date: number; project: Project; org: string }[] = []

            // 包含進行中和已結案的個案，以顯示完整匯款紀錄
            const allTrackingProjects = [...activeProjects, ...completedProjects]

            allTrackingProjects.forEach(p => {
              const committeeStep = p.workflow.find(s => s.name.includes("評議委員會"))
              const org = organizations.find(o => o.id === p.organizationId)

              // 評議委員會日期（從評議委員會步驟的 subTask[0].note 取得）
              if (committeeStep?.subTasks?.[0]?.note) {
                const meetingDate = committeeStep.subTasks[0].note
                if (meetingDate.startsWith(currentMonthStr)) {
                  const day = parseInt(meetingDate.split('-')[2])
                  monthEvents.push({ date: day, type: 'committee', project: p })
                  committeeProjects.push({ date: day, project: p, org: org?.name || '' })
                }
              }

              // 從評議委員會步驟取得補助類型和金額
              let subsidyData: { subsidyType?: string; oneTimeAmount?: string; periodicAmount?: string; periodStart?: string; periodEnd?: string; frequency?: string; periodicMonths?: string } = {}
              if (committeeStep?.note) {
                try {
                  subsidyData = JSON.parse(committeeStep.note)
                } catch {}
              }

              // 從結案步驟取得實際匯款日期
              const closingStep = p.workflow.find(s => s.name.includes("結案"))
              let closingData: { paymentDate?: string; trackingDates?: string[] } = {}
              if (closingStep?.note) {
                try {
                  closingData = JSON.parse(closingStep.note)
                } catch {}
              }

              // 一次性補助：檢查匯款日期是否在當月
              if (subsidyData.subsidyType === 'oneTime') {
                const paymentDate = closingData.paymentDate || ''
                if (paymentDate && paymentDate.startsWith(currentMonthStr)) {
                  const day = parseInt(paymentDate.split('-')[2])
                  const amount = Number(subsidyData.oneTimeAmount) || 0
                  oneTimePayments.push({ project: p, amount, org: org?.name || '', date: day })
                  monthEvents.push({ date: day, type: 'oneTime', project: p })
                }
              } else if (subsidyData.subsidyType === 'periodic') {
                // 期間性補助：檢查當月是否在補助期間內
                const periodStart = new Date(subsidyData.periodStart || '')
                const periodEnd = new Date(subsidyData.periodEnd || '')
                const currentDate = new Date(trackingMonth.year, trackingMonth.month, 15)

                if (currentDate >= periodStart && currentDate <= periodEnd) {
                  const amount = Number(subsidyData.periodicAmount) || 0
                  periodicPayments.push({
                    project: p,
                    amount,
                    org: org?.name || '',
                    frequency: subsidyData.frequency === 'monthly' ? '每月' : `每${subsidyData.periodicMonths}月`
                  })
                  // 期間性匯款顯示在月初
                  monthEvents.push({ date: 1, type: 'periodic', project: p })
                }
              }
            })

            const totalOneTime = oneTimePayments.reduce((sum, p) => sum + p.amount, 0)
            const totalPeriodic = periodicPayments.reduce((sum, p) => sum + p.amount, 0)

            // 按日期和類型分組事件
            const groupedEvents = monthEvents.reduce((acc, event) => {
              const key = `${event.date}-${event.type}`
              if (!acc[key]) {
                acc[key] = { date: event.date, type: event.type, projects: [] }
              }
              acc[key].projects.push(event.project)
              return acc
            }, {} as Record<string, { date: number; type: 'committee' | 'oneTime' | 'periodic'; projects: Project[] }>)

            return (
              <div className="flex flex-col md:flex-row gap-4 md:gap-6 min-h-full overflow-y-auto pb-6">
                {/* 左側：匯款清單（33%） */}
                <div className="w-full md:flex-[1] md:min-w-[300px] border rounded-lg bg-card md:overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                    <h3 className="font-semibold">
                      {trackingMonth.year} 年 {monthNames[trackingMonth.month]} 匯款
                    </h3>
                    <span className="text-lg font-bold text-primary">
                      NT$ {(totalOneTime + totalPeriodic).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex-1 md:overflow-y-auto p-4 space-y-4">
                    {/* 評議委員會 */}
                    {committeeProjects.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-purple-600">評議委員會</span>
                          <Badge variant="outline" className="text-purple-600 border-purple-300">
                            {committeeProjects.length} 案
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {committeeProjects.map(({ date, project, org }) => (
                            <div
                              key={project.id}
                              className={cn(
                                "p-2 rounded border cursor-pointer",
                                project.status === 'completed'
                                  ? "bg-gray-50 dark:bg-gray-950/20 hover:bg-gray-100 dark:hover:bg-gray-950/30 opacity-70"
                                  : "bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-950/30"
                              )}
                              onClick={() => {
                                const plan = plans.find(pl => pl.id === project.planId)
                                if (plan) {
                                  handleSelectPlan(plan)
                                  setTimeout(() => setSelectedProject(project), 100)
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{project.name}</span>
                                  {project.status === 'completed' && (
                                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">已結案</Badge>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-xs">{date} 日</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">{org}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 一次性補助 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {oneTimePayments.length > 0 && (
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                              checked={oneTimePayments.every(({ project }) => checkedPayments.has(`oneTime-${project.id}`))}
                              onChange={(e) => {
                                const newChecked = new Set(checkedPayments)
                                oneTimePayments.forEach(({ project }) => {
                                  if (e.target.checked) {
                                    newChecked.add(`oneTime-${project.id}`)
                                  } else {
                                    newChecked.delete(`oneTime-${project.id}`)
                                  }
                                })
                                setCheckedPayments(newChecked)
                              }}
                            />
                          )}
                          <span className="text-sm font-medium text-orange-600">一次性補助</span>
                        </div>
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          {oneTimePayments.length} 筆 · NT$ {totalOneTime.toLocaleString()}
                        </Badge>
                      </div>
                      {oneTimePayments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">本月無一次性匯款</p>
                      ) : (
                        <div className="space-y-2">
                          {oneTimePayments.map(({ project, amount, org, date }) => (
                            <div
                              key={project.id}
                              className={cn(
                                "p-2 rounded border flex items-start gap-2",
                                checkedPayments.has(`oneTime-${project.id}`)
                                  ? "bg-green-50 dark:bg-green-950/20 border-green-300"
                                  : project.status === 'completed'
                                  ? "bg-gray-50 dark:bg-gray-950/20 opacity-70"
                                  : "bg-orange-50 dark:bg-orange-950/20"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0"
                                checked={checkedPayments.has(`oneTime-${project.id}`)}
                                onChange={(e) => {
                                  const newChecked = new Set(checkedPayments)
                                  if (e.target.checked) {
                                    newChecked.add(`oneTime-${project.id}`)
                                  } else {
                                    newChecked.delete(`oneTime-${project.id}`)
                                  }
                                  setCheckedPayments(newChecked)
                                }}
                              />
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => {
                                  const plan = plans.find(pl => pl.id === project.planId)
                                  if (plan) {
                                    handleSelectPlan(plan)
                                    setTimeout(() => setSelectedProject(project), 100)
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{project.name}</span>
                                    {project.status === 'completed' && (
                                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">已結案</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">{date} 日</Badge>
                                    <span className="text-sm font-semibold text-orange-600">
                                      NT$ {amount.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">{org}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 期間性補助 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {periodicPayments.length > 0 && (
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                              checked={periodicPayments.every(({ project }) => checkedPayments.has(`periodic-${project.id}`))}
                              onChange={(e) => {
                                const newChecked = new Set(checkedPayments)
                                periodicPayments.forEach(({ project }) => {
                                  if (e.target.checked) {
                                    newChecked.add(`periodic-${project.id}`)
                                  } else {
                                    newChecked.delete(`periodic-${project.id}`)
                                  }
                                })
                                setCheckedPayments(newChecked)
                              }}
                            />
                          )}
                          <span className="text-sm font-medium text-blue-600">期間性補助</span>
                        </div>
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          {periodicPayments.length} 筆 · NT$ {totalPeriodic.toLocaleString()}
                        </Badge>
                      </div>
                      {periodicPayments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">本月無期間性匯款</p>
                      ) : (
                        <div className="space-y-2">
                          {periodicPayments.map(({ project, amount, org, frequency }) => (
                            <div
                              key={project.id}
                              className={cn(
                                "p-2 rounded border flex items-start gap-2",
                                checkedPayments.has(`periodic-${project.id}`)
                                  ? "bg-green-50 dark:bg-green-950/20 border-green-300"
                                  : project.status === 'completed'
                                  ? "bg-gray-50 dark:bg-gray-950/20 opacity-70"
                                  : "bg-blue-50 dark:bg-blue-950/20"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0"
                                checked={checkedPayments.has(`periodic-${project.id}`)}
                                onChange={(e) => {
                                  const newChecked = new Set(checkedPayments)
                                  if (e.target.checked) {
                                    newChecked.add(`periodic-${project.id}`)
                                  } else {
                                    newChecked.delete(`periodic-${project.id}`)
                                  }
                                  setCheckedPayments(newChecked)
                                }}
                              />
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => {
                                  const plan = plans.find(pl => pl.id === project.planId)
                                  if (plan) {
                                    handleSelectPlan(plan)
                                    setTimeout(() => setSelectedProject(project), 100)
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{project.name}</span>
                                    {project.status === 'completed' && (
                                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">已結案</Badge>
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold text-blue-600">
                                    NT$ {amount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">{org} · {frequency}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右側：行事曆（67%） */}
                <div className="w-full md:flex-[2] md:min-w-[400px] border rounded-lg bg-card md:overflow-hidden flex flex-col">
                  {/* 月份切換 */}
                  <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setTrackingMonth(prev => {
                          if (prev.month === 0) {
                            return { year: prev.year - 1, month: 11 }
                          }
                          return { ...prev, month: prev.month - 1 }
                        })
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold text-sm">
                      {trackingMonth.year} 年 {monthNames[trackingMonth.month]}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setTrackingMonth(prev => {
                          if (prev.month === 11) {
                            return { year: prev.year + 1, month: 0 }
                          }
                          return { ...prev, month: prev.month + 1 }
                        })
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 行事曆格子 */}
                  <div className="flex-1 p-4 md:overflow-y-auto">
                    {/* 星期標題 */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                        <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    {/* 日期格子 */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* 前面的空白格子 */}
                      {Array.from({ length: startDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                      ))}
                      {/* 日期格子 */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1
                        const today = new Date()
                        const isToday = today.getFullYear() === trackingMonth.year &&
                                        today.getMonth() === trackingMonth.month &&
                                        today.getDate() === day

                        // 找出當天的分組事件
                        const dayGroupedEvents = Object.values(groupedEvents).filter(e => e.date === day)
                        const hasEvents = dayGroupedEvents.length > 0

                        return (
                          <div
                            key={day}
                            className={cn(
                              "aspect-square md:border rounded-lg p-1 text-sm relative min-h-[64px] md:min-h-[48px]",
                              isToday && "border-primary border-2 md:border-2",
                              hasEvents && "cursor-pointer hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "font-medium text-center",
                              isToday && "text-primary"
                            )}>
                              {day}
                            </div>
                            {/* 事件標記（按類型合併顯示） */}
                            <div className="absolute top-7 left-1 right-1 flex flex-wrap gap-1 justify-center">
                              {dayGroupedEvents.map((group, idx) => (
                                group.type === 'committee' ? (
                                  <div
                                    key={idx}
                                    className="px-2 py-1 rounded-full bg-purple-500 text-white text-xs font-medium cursor-pointer shadow-sm whitespace-nowrap"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setTrackingEventPopup({
                                        isOpen: true,
                                        date: day,
                                        type: group.type,
                                        title: '評議委員會',
                                        projects: group.projects
                                      })
                                    }}
                                    title={`評議委員會: ${group.projects.length} 案`}
                                  >
                                    評議委員會 {group.projects.length}
                                  </div>
                                ) : (
                                  <div
                                    key={idx}
                                    className={cn(
                                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer shadow-sm",
                                      group.type === 'oneTime' && "bg-orange-500 text-white",
                                      group.type === 'periodic' && "bg-blue-500 text-white"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setTrackingEventPopup({
                                        isOpen: true,
                                        date: day,
                                        type: group.type,
                                        title: group.type === 'oneTime' ? '一次性匯款' : '期間性匯款',
                                        projects: group.projects
                                      })
                                    }}
                                    title={`${group.type === 'oneTime' ? '一次性' : '期間性'}: ${group.projects.length} 案`}
                                  >
                                    {group.projects.length}
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* 圖例 */}
                    <div className="mt-4 pt-3 border-t flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-purple-500" />
                        <span>評議委員會</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-orange-500" />
                        <span>一次性匯款</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500" />
                        <span>期間性匯款</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 事件彈窗 */}
                {trackingEventPopup?.isOpen && (
                  <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setTrackingEventPopup(null)}
                  >
                    <div
                      className="bg-card border rounded-lg shadow-xl w-96 max-h-[80vh] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={cn(
                        "p-4 border-b",
                        trackingEventPopup.type === 'committee' && "bg-purple-100 dark:bg-purple-950/30",
                        trackingEventPopup.type === 'oneTime' && "bg-orange-100 dark:bg-orange-950/30",
                        trackingEventPopup.type === 'periodic' && "bg-blue-100 dark:bg-blue-950/30"
                      )}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">
                            {trackingMonth.month + 1}/{trackingEventPopup.date} - {trackingEventPopup.title}
                          </h3>
                          <Badge variant="secondary">{trackingEventPopup.projects.length} 案</Badge>
                        </div>
                      </div>
                      <div className="p-4 space-y-1.5 max-h-[60vh] overflow-y-auto">
                        {trackingEventPopup.projects.map(project => {
                          const org = organizations.find(o => o.id === project.organizationId)
                          const plan = plans.find(pl => pl.id === project.planId)
                          const checkKey = trackingEventPopup.type === 'oneTime'
                            ? `oneTime-${project.id}`
                            : trackingEventPopup.type === 'periodic'
                            ? `periodic-${project.id}`
                            : `committee-${project.id}`
                          return (
                            <div
                              key={project.id}
                              className={cn(
                                "p-2 border rounded-lg flex items-center gap-2 transition-colors",
                                checkedPayments.has(checkKey)
                                  ? "bg-green-50 dark:bg-green-950/20 border-green-300"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              {trackingEventPopup.type !== 'committee' && (
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 cursor-pointer shrink-0"
                                  checked={checkedPayments.has(checkKey)}
                                  onChange={(e) => {
                                    const newChecked = new Set(checkedPayments)
                                    if (e.target.checked) {
                                      newChecked.add(checkKey)
                                    } else {
                                      newChecked.delete(checkKey)
                                    }
                                    setCheckedPayments(newChecked)
                                  }}
                                />
                              )}
                              <div
                                className="flex-1 flex items-center justify-between cursor-pointer min-w-0 gap-2"
                                onClick={() => {
                                  setTrackingEventPopup(null)
                                  if (plan) {
                                    handleSelectPlan(plan)
                                    setTimeout(() => setSelectedProject(project), 100)
                                  }
                                }}
                              >
                                <span className="font-medium text-sm truncate">{project.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {org && <span className="text-xs text-muted-foreground">{org.name}</span>}
                                  {plan && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{plan.name}</Badge>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="p-3 border-t bg-muted/30">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setTrackingEventPopup(null)}
                        >
                          關閉
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()
        )}

        {/* Flow View Project Modal */}
        {viewMode === 'flow' && flowProjectModal && selectedProject && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4"
            onClick={() => {
              setFlowProjectModal(null)
              setSelectedProject(null)
            }}
          >
            <div
              key={`flow-modal-${selectedProject.id}`}
              className="bg-card border rounded-lg shadow-xl w-full h-full md:w-[90vw] md:max-w-6xl md:h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {ProjectDetailColumn()}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Projects Column Component
  const ProjectsColumn = () => (
    <div className="flex flex-col md:h-full">
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
          <div className="flex items-center justify-between flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className="h-5 w-5 shrink-0" />
              {/* Mobile: dropdown to select plan */}
              <div className="md:hidden flex-1 min-w-0">
                {showArchivedProjects ? (
                  <span className="text-lg font-semibold">不成立</span>
                ) : (
                  <Select
                    value={selectedPlan?.id || ""}
                    onValueChange={(planId) => {
                      const plan = plans.find(p => p.id === planId)
                      if (plan) handleSelectPlan(plan)
                    }}
                  >
                    <SelectTrigger className="h-8 border-0 shadow-none p-0 font-semibold text-base focus:ring-0">
                      <SelectValue placeholder="選擇計畫" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* Desktop: show 個案 */}
              <span className="hidden md:inline text-lg font-semibold">
                {showArchivedProjects ? "不成立" : "個案"}
              </span>
            </div>
            {/* Desktop only: X and + buttons in header */}
            {selectedPlan && (
              <div className="hidden md:flex items-center gap-1">
                {/* Archived button */}
                <Button
                  variant={showArchivedProjects ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setShowArchivedProjects(!showArchivedProjects)
                  }}
                  title={showArchivedProjects ? "返回個案列表" : "查看不成立個案"}
                >
                  <XCircle className="h-4 w-4" />
                  {archivedProjectCount > 0 && !showArchivedProjects && (
                    <span className="ml-1 text-xs">{archivedProjectCount}</span>
                  )}
                </Button>
                {!showArchivedProjects && (
                  <Button size="sm" onClick={() => openProjectForm()}>
                    <Plus className="h-4 w-4" />
                    <span className="ml-1">個案</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Mobile: Search + actions row */}
        {selectedPlan && (
          <div className="md:hidden flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋個案..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button
              variant={showArchivedProjects ? "secondary" : "ghost"}
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              onClick={() => {
                setShowArchivedProjects(!showArchivedProjects)
              }}
              title={showArchivedProjects ? "返回個案列表" : "查看不成立個案"}
            >
              <XCircle className="h-4 w-4" />
            </Button>
            {!showArchivedProjects && (
              <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => openProjectForm()}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {/* Desktop: Search row */}
        {selectedPlan && (
          <div className="hidden md:block relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋個案..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}
      </div>

      {/* Desktop: ScrollArea, Mobile: natural flow */}
      <div className="md:hidden">
        {!selectedPlan ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            請選擇計畫
          </div>
        ) : planProjects.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            {projectSearch
              ? "無符合的個案"
              : showArchivedProjects
              ? "此計畫下無不成立個案"
              : "此計畫下尚無個案"}
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
                      {/* Mobile: name only (no badge) */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{project.name}</span>
                        {project.status === "not_established" && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            不成立
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 hidden md:block">
        {!selectedPlan ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            請選擇計畫
          </div>
        ) : planProjects.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            {projectSearch
              ? "無符合的個案"
              : showArchivedProjects
              ? "此計畫下無不成立個案"
              : "此計畫下尚無個案"}
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
                      {/* Desktop: name + source type badge */}
                      <div className="hidden md:flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{project.name}</span>
                        {project.description && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {project.description}
                          </Badge>
                        )}
                        {project.status === "not_established" && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            不成立
                          </Badge>
                        )}
                      </div>
                      {/* Mobile: name only (no badge) */}
                      <div className="md:hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{project.name}</span>
                          {project.status === "not_established" && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              不成立
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
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
            <p>選擇一個個案查看詳情</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b shrink-0 overflow-hidden">
          {/* Mobile back button */}
          <div className="flex items-center gap-2 mb-2 md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (viewMode === 'flow') {
                  // In flow mode, close the modal and stay in flow view
                  setFlowProjectModal(null)
                  setSelectedProject(null)
                } else {
                  setSelectedProject(null)
                  setMobileView("projects")
                }
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
                {selectedProject.description && (
                  <Badge variant="outline">{selectedProject.description}</Badge>
                )}
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
                onClick={() => {
                  savedScrollPositionRef.current = projectDetailScrollRef.current?.scrollTop || 0
                  openProjectForm(selectedProject)
                }}
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

        <div key="project-detail-scroll" ref={projectDetailScrollRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden" style={{ overflowAnchor: 'none' }}>
          <div className="p-4 space-y-6">
            {/* Workflow Progress */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">流程進度</h3>
                <span className="text-xs text-muted-foreground">
                  建立於 {format(new Date(selectedProject.createdAt), "yyyy/MM/dd HH:mm")}
                </span>
              </div>
              {/* 橫向滾動容器 */}
              <div
                className="overflow-x-auto pb-2 -mx-4 px-4"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex gap-3 py-4 px-2 bg-muted/30 rounded-lg w-max items-start">
                  {selectedProject.workflow.map((step, index) => {
                    // 判斷是否為目前步驟：索引符合且狀態為 in_progress 或未設定狀態（向下相容舊資料）
                    const isCurrentStep = index === selectedProject.currentStep &&
                      (step.status === "in_progress" || !step.status || step.status === "pending" && index === 0)
                    // 判斷是否為還沒輪到的步驟：pending 狀態或未設定狀態且不是當前步驟
                    const isInactive = (step.status === "pending" || (!step.status && index > selectedProject.currentStep)) && !isCurrentStep

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

                    // 審核步驟改用下方表單，不在流程圖上顯示按鈕
                    const showApprovalButtons = canUserApprove() && selectedProject.status === "active" && step.type !== "establishment"
                    const showExecuteButton = canUserExecute() && selectedProject.status === "active"

                    // Determine if node should be interactive
                    const hasRejectOption = (step.type === "approval" && hasPendingExecution)
                    const canReject = showApprovalButtons && hasRejectOption

                    return (
                      <div
                        key={step.id}
                        className={cn(
                          "flex items-start gap-3",
                          isInactive && "opacity-40"
                        )}
                      >
                        <div
                          className={cn(
                            "flex flex-col items-center transition-all",
                            isCurrentStep ? "min-w-[70px]" : "min-w-[50px]"
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
                                {index + 1}
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
                                      if (confirm("確定要將此個案設為不成立嗎？")) {
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

                          </div>

                          {/* Step Name */}
                          <span className={cn(
                            "mt-2 text-center font-medium leading-tight",
                            isCurrentStep ? "text-sm" : "text-xs"
                          )}>
                            {step.name}
                          </span>


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

            {/* 個案內容 - Document Style */}
            <Card className="overflow-hidden">
                <CardContent className="p-0 overflow-hidden">
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
                      // 允許 establishment 類型的步驟上傳（包括已完成的，因為可以補傳）
                      const canUpload = step.type === "establishment" || (step.requireAttachment && step.type !== "approval" && (step.status === "in_progress" || step.status === "pending"))
                      // Get executions for this step
                      const currentStepExecutions = stepExecutions.filter(e => e.stepId === step.id)
                      const pendingExecution = currentStepExecutions.find(e => e.verificationStatus === "pending")

                      // Check if user can edit this step content (sub-tasks, notes)
                      // For approved steps: only super_admin or originally assigned users, AND must be in edit mode
                      const hasEditPermission = () => {
                        if (!user) return false
                        if (user.role === "super_admin") return true
                        if (isCompletedStep) {
                          // Only assigned users can edit completed steps
                          if (step.assigneeUserIds?.includes(user.id)) return true
                          if (step.verifierUserIds?.includes(user.id)) return true
                          if (step.approverUserIds?.includes(user.id)) return true
                          return false
                        }
                        return true // Non-completed steps can be edited by anyone
                      }
                      // Actually allow editing only if has permission AND (not completed OR in edit mode)
                      const canEditStep = () => {
                        if (!hasEditPermission()) return false
                        if (isCompletedStep) {
                          // Completed steps need to be in edit mode
                          return editingStepId === step.id
                        }
                        return true
                      }

                      // Check if this is current approval step and user can execute
                      const isCurrentApprovalStep = step.type === "approval" &&
                        originalIndex === selectedProject.currentStep &&
                        (step.status === "in_progress" || !step.status)
                      const userCanExecute = user && isCurrentApprovalStep && !pendingExecution && (
                        !step.assigneeTagId || user.adminTags?.includes(step.assigneeTagId)
                      )

                      const hasContent = (step.attachments && step.attachments.length > 0) || step.note || hasSubTasks || canUpload || currentStepExecutions.length > 0 || userCanExecute

                      // Check if this is a completed step (approved/rejected)
                      const isCompletedStep = step.status === "approved" || step.status === "rejected" || step.status === "not_established"
                      // Next step is also completed?
                      const nextStep = filteredSteps[idx + 1]
                      const nextIsCompleted = nextStep && (nextStep.status === "approved" || nextStep.status === "rejected" || nextStep.status === "not_established")
                      // Show border only if not both completed
                      const showBorder = idx !== filteredSteps.length - 1 && !(isCompletedStep && nextIsCompleted)

                      return (
                        <div
                          key={step.id}
                          data-step-id={step.id}
                          className={cn(
                            "p-6 overflow-hidden",
                            showBorder && "border-b"
                          )}
                        >
                          {/* Step Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                {originalIndex + 1}.
                              </span>
                              <span className="text-sm font-medium text-muted-foreground">{step.name}</span>
                              {step.approvedAt && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(step.approvedAt), "yyyy/MM/dd")}
                                </span>
                              )}
                              {/* Edit button for completed steps - right after step name */}
                              {isCompletedStep && hasEditPermission() && (
                                editingStepId === step.id ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const stepId = step.id
                                      setEditingStepId(null)
                                      requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                          document.querySelector(`[data-step-id="${stepId}"]`)?.scrollIntoView({ block: 'nearest' })
                                        })
                                      })
                                    }}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const stepId = step.id
                                      setEditingStepId(stepId)
                                      requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                          document.querySelector(`[data-step-id="${stepId}"]`)?.scrollIntoView({ block: 'nearest' })
                                        })
                                      })
                                    }}
                                  >
                                    <EditIcon className="h-3.5 w-3.5" />
                                  </Button>
                                )
                              )}
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
                                  {/* Executor Assignment for approval steps (not evaluation) */}
                                  {step.type === "approval" && !step.name.includes("評估") && (
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
                                  {/* Verifier Assignment for approval steps (not evaluation) */}
                                  {step.type === "approval" && !step.name.includes("評估") && (
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
                          </div>

                          {/* Content Area */}
                          {hasContent && (
                            <div className="space-y-3">
                              {/* 評估表：始終顯示附件、預期金額和評議委員會日期 */}
                              {step.name.includes("評估") && (
                                <div className="space-y-4" id={`eval-form-${step.id}`}>
                                    {/* 評估表附件 - 水平滾動 */}
                                    {((step.attachments && step.attachments.length > 0) || canEditStep()) && (
                                      <div
                                        className="overflow-x-auto -mx-4 px-4 snap-x snap-mandatory md:snap-none"
                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                      >
                                        <div className="flex gap-4 items-start" style={{ width: 'max-content' }}>
                                          {step.attachments?.map((attachment) => (
                                            <div key={attachment.id} className="flex-shrink-0 snap-center w-[90vw] md:w-auto flex items-center justify-center">
                                              {attachment.mimeType === "application/pdf" ? (
                                                <PDFPageViewer
                                                  url={attachment.originalUrl}
                                                  pageHeight="60vh"
                                                />
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => setPreviewFile({
                                                    url: attachment.originalUrl,
                                                    type: attachment.mimeType,
                                                    name: attachment.fileName
                                                  })}
                                                  className="group relative hover:opacity-90 transition-opacity"
                                                >
                                                  <img
                                                    src={attachment.thumbnailUrl || attachment.originalUrl}
                                                    alt={attachment.fileName}
                                                    className="h-[60vh] w-auto max-w-[90vw] md:max-w-none object-contain rounded"
                                                  />
                                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center rounded">
                                                    <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                  </div>
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                          {/* 上傳按鈕 - 編輯模式 */}
                                          {canEditStep() && (
                                            <div className="flex-shrink-0 snap-center h-[60vh] w-[90vw] md:w-[180px] flex items-center justify-center">
                                              <DropZone
                                                accept="image/*,application/pdf"
                                                multiple
                                                className="h-full w-full md:w-[180px]"
                                                onFilesSelected={async (files) => {
                                                  const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
                                                  const validFiles = files.filter(file => {
                                                    const validation = validateFile(file, 'receipt')
                                                    return validation.valid
                                                  })
                                                  if (validFiles.length === 0) return
                                                  try {
                                                    const results = await imageService.uploadMultiple(validFiles, 'receipt')
                                                    const existingAttachments = (step.attachments || []).map(att => ({
                                                      id: att.id,
                                                      originalUrl: att.originalUrl,
                                                      thumbnailUrl: att.thumbnailUrl,
                                                      fileName: att.fileName,
                                                      fileSize: att.fileSize,
                                                      mimeType: att.mimeType,
                                                      order: att.order,
                                                    }))
                                                    const startOrder = existingAttachments.length
                                                    const newAttachments = results.map((img, idx) => ({
                                                      ...img,
                                                      order: startOrder + idx,
                                                    }))
                                                    updateStepAttachments(selectedProject, originalIndex, [...existingAttachments, ...newAttachments])
                                                    setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
                                                  } catch (err) {
                                                    console.error('Upload failed:', err)
                                                  }
                                                }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* 預期金額 & 評議委員會日期 */}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label>預期金額</Label>
                                        {canEditStep() ? (
                                          <Input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="輸入預期補助金額..."
                                            defaultValue={step.note || ""}
                                            data-budget-input={step.id}
                                          />
                                        ) : step.note ? (
                                          <div className="text-sm font-medium">{step.note}</div>
                                        ) : <div className="text-sm text-muted-foreground">-</div>}
                                      </div>
                                      <div className="space-y-2">
                                        <Label>評議委員會日期</Label>
                                        {canEditStep() ? (
                                          <Input
                                            type="date"
                                            id={`committee-date-inline-${step.id}`}
                                            defaultValue={(() => {
                                              // Get the date from next step (評議委員會)
                                              const nextStep = selectedProject.workflow[originalIndex + 1]
                                              return nextStep?.subTasks?.[0]?.note || ""
                                            })()}
                                            onChange={async (e) => {
                                              // Update the 評議委員會 step's subTask note with the date
                                              const nextStepIndex = originalIndex + 1
                                              if (nextStepIndex < selectedProject.workflow.length) {
                                                const newWorkflow = [...selectedProject.workflow]
                                                const nextStep = newWorkflow[nextStepIndex]
                                                if (nextStep.subTasks && nextStep.subTasks.length > 0) {
                                                  nextStep.subTasks[0].note = e.target.value
                                                  await projectService.updateProject(selectedProject.id, { workflow: newWorkflow })
                                                  const updated = await projectService.getProjectById(selectedProject.id)
                                                  if (updated) setSelectedProject(updated)
                                                }
                                              }
                                            }}
                                          />
                                        ) : (
                                          <div className="text-sm font-medium">
                                            {(() => {
                                              const nextStep = selectedProject.workflow[originalIndex + 1]
                                              return nextStep?.subTasks?.[0]?.note || "-"
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* 訪視紀錄 - 只有個人申請才顯示 */}
                                    {selectedProject.description === "個人" && (
                                      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                                        <div className="font-medium">訪視紀錄</div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>訪視日期</Label>
                                            {canEditStep() ? (
                                              <Input
                                                type="date"
                                                defaultValue={(() => {
                                                  try {
                                                    const visit = JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                    return visit.date || ""
                                                  } catch { return "" }
                                                })()}
                                                onChange={(e) => {
                                                  const currentData = (() => {
                                                    try {
                                                      return JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                    } catch { return {} }
                                                  })()
                                                  currentData.date = e.target.value
                                                  // Store visit data in a special way
                                                  const visitData: ImageData = {
                                                    id: "visit-record",
                                                    originalUrl: "",
                                                    thumbnailUrl: "",
                                                    fileName: JSON.stringify(currentData),
                                                    fileSize: 0,
                                                    mimeType: "application/json",
                                                    order: 0
                                                  }
                                                  handleUpdateStepAttachments(selectedProject, originalIndex, [visitData])
                                                }}
                                              />
                                            ) : (
                                              <div className="text-sm">
                                                {(() => {
                                                  try {
                                                    const visit = JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                    return visit.date || "-"
                                                  } catch { return "-" }
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                          <div className="space-y-2">
                                            <Label>訪視人員</Label>
                                            {canEditStep() ? (
                                              <Input
                                                type="text"
                                                placeholder="填寫訪視人員..."
                                                defaultValue={(() => {
                                                  try {
                                                    const visit = JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                    return visit.visitor || ""
                                                  } catch { return "" }
                                                })()}
                                                onBlur={(e) => {
                                                  const currentData = (() => {
                                                    try {
                                                      return JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                    } catch { return {} }
                                                  })()
                                                  currentData.visitor = e.target.value
                                                  const visitData: ImageData = {
                                                    id: "visit-record",
                                                    originalUrl: "",
                                                    thumbnailUrl: "",
                                                    fileName: JSON.stringify(currentData),
                                                    fileSize: 0,
                                                    mimeType: "application/json",
                                                    order: 0
                                                  }
                                                  handleUpdateStepAttachments(selectedProject, originalIndex, [visitData])
                                                }}
                                              />
                                            ) : (
                                              <div className="text-sm">
                                                {(() => {
                                                  try {
                                                    const visit = JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                    return visit.visitor || "-"
                                                  } catch { return "-" }
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>訪視內容</Label>
                                          {canEditStep() ? (
                                            <textarea
                                              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                              placeholder="填寫訪視內容..."
                                              defaultValue={(() => {
                                                try {
                                                  const visit = JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                  return visit.content || ""
                                                } catch { return "" }
                                              })()}
                                              onBlur={(e) => {
                                                const currentData = (() => {
                                                  try {
                                                    return JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                  } catch { return {} }
                                                })()
                                                currentData.content = e.target.value
                                                const visitData: ImageData = {
                                                  id: "visit-record",
                                                  originalUrl: "",
                                                  thumbnailUrl: "",
                                                  fileName: JSON.stringify(currentData),
                                                  fileSize: 0,
                                                  mimeType: "application/json",
                                                  order: 0
                                                }
                                                handleUpdateStepAttachments(selectedProject, originalIndex, [visitData])
                                              }}
                                            />
                                          ) : (
                                            <div className="text-sm whitespace-pre-wrap">
                                              {(() => {
                                                try {
                                                  const visit = JSON.parse(step.attachments?.[0]?.fileName || "{}")
                                                  return visit.content || "-"
                                                } catch { return "-" }
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                              )}

                              {/* Sub-tasks for other steps (not 評估表, 評議委員會, 結案) */}
                              {hasSubTasks && !step.name.includes("評估") && !step.name.includes("評議委員會") && !step.name.includes("結案") && (
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
                                          {subTask.completed && subTask.completedAt && (
                                            <span className="text-xs text-muted-foreground">
                                              {format(new Date(subTask.completedAt), "MM/dd")}
                                            </span>
                                          )}
                                          <span className="text-sm flex-1">
                                            {subTask.name}
                                            {subTask.requireAttachment && (
                                              <Paperclip className="inline-block h-3 w-3 ml-1 text-muted-foreground" />
                                            )}
                                          </span>
                                        </label>
                                        {/* 文件寄發及簽核 不顯示說明輸入欄 */}
                                        {!step.name.includes("文件寄發") && (
                                          canEditStep() ? (
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
                                          ) : null
                                        )}
                                      </div>
                                    ))}
                                  </div>
                              )}

                              {/* Text Note - Document Style (不顯示評議委員會和結案的JSON資料) */}
                              {step.note && !step.name.includes("評議委員會") && !step.name.includes("結案") && (
                                <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap">
                                  {step.note}
                                </div>
                              )}

                              {/* Attachments & Upload - Horizontal Scroll with Mobile Snap (不顯示評估表，因為有專用區塊) */}
                              {!step.name.includes("評估") && ((step.attachments && step.attachments.length > 0) || canUpload) && (
                                <div
                                  className="overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory md:snap-none"
                                  style={{ WebkitOverflowScrolling: 'touch' }}
                                >
                                  <div className="flex gap-4 md:gap-4 items-start" style={{ width: 'max-content' }}>
                                    {step.attachments?.map((attachment) => (
                                      <div key={attachment.id} className="flex-shrink-0 snap-center w-[90vw] md:w-auto flex items-center justify-center">
                                        {attachment.mimeType === "application/pdf" ? (
                                          <PDFPageViewer
                                            url={attachment.originalUrl}
                                            pageHeight="70vh"
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setPreviewFile({
                                              url: attachment.originalUrl,
                                              type: attachment.mimeType,
                                              name: attachment.fileName
                                            })}
                                            className="group relative hover:opacity-90 transition-opacity"
                                          >
                                            <img
                                              src={attachment.thumbnailUrl || attachment.originalUrl}
                                              alt={attachment.fileName}
                                              className="h-[70vh] w-auto max-w-[90vw] md:max-w-none object-contain rounded"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center rounded">
                                              <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    {/* Inline upload button - only in edit mode */}
                                    {canUpload && (
                                      <div className="flex-shrink-0 snap-center h-[70vh] w-[90vw] md:w-[180px] flex items-center justify-center">
                                        <DropZone
                                          accept="image/*,application/pdf"
                                          multiple
                                          className="h-full"
                                          onFilesSelected={async (files) => {
                                            const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
                                            const validFiles = files.filter(file => {
                                              const validation = validateFile(file, 'receipt')
                                              return validation.valid
                                            })
                                            if (validFiles.length === 0) return

                                            try {
                                              const results = await imageService.uploadMultiple(validFiles, 'receipt')
                                              const existingAttachments = (step.attachments || []).map(att => ({
                                                id: att.id,
                                                originalUrl: att.originalUrl,
                                                thumbnailUrl: att.thumbnailUrl,
                                                fileName: att.fileName,
                                                fileSize: att.fileSize,
                                                mimeType: att.mimeType,
                                                order: att.order,
                                              }))
                                              const startOrder = existingAttachments.length
                                              const newAttachments = results.map((img, idx) => ({
                                                ...img,
                                                order: startOrder + idx,
                                              }))
                                              updateStepAttachments(selectedProject, originalIndex, [...existingAttachments, ...newAttachments])
                                              setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
                                            } catch (err) {
                                              console.error('Upload failed:', err)
                                            }
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Execution submissions for approval steps - horizontal scroll */}
                              {currentStepExecutions.length > 0 && (
                                <div className="overflow-x-auto pb-2 -mx-4 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                                  <div className="flex gap-4 w-max">
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
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  // Save scroll position
                                                  const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
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
                                                  // Restore scroll position after React render
                                                  setTimeout(() => {
                                                    if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop
                                                  }, 100)
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
                                              <div
                                                className="mt-1 overflow-x-auto -mx-3 px-3 snap-x snap-mandatory md:snap-none"
                                                style={{ WebkitOverflowScrolling: 'touch' }}
                                              >
                                                <div className="flex gap-3 items-start" style={{ width: 'max-content' }}>
                                                  {editExecAttachments.map((attachment) => (
                                                    <div key={attachment.id} className="flex-shrink-0 snap-center w-[80vw] md:w-auto flex items-center justify-center">
                                                      {attachment.mimeType === "application/pdf" ? (
                                                        <PDFPageViewer
                                                          url={attachment.originalUrl}
                                                          pageHeight="35vh"
                                                        />
                                                      ) : (
                                                        <img
                                                          src={attachment.thumbnailUrl || attachment.originalUrl}
                                                          alt={attachment.fileName}
                                                          className="h-[35vh] w-auto max-w-[80vw] md:max-w-none object-contain rounded"
                                                        />
                                                      )}
                                                    </div>
                                                  ))}
                                                  <div className="flex-shrink-0 snap-center h-[35vh] w-[80vw] md:w-[120px] flex items-center justify-center">
                                                    <DropZone
                                                      accept="image/*,application/pdf"
                                                      multiple
                                                      className="h-full w-full md:w-[120px]"
                                                      onFilesSelected={async (files) => {
                                                        const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
                                                        const validFiles = files.filter(file => {
                                                          const validation = validateFile(file, 'receipt')
                                                          return validation.valid
                                                        })
                                                        if (validFiles.length === 0) return
                                                        try {
                                                          const results = await imageService.uploadMultiple(validFiles, 'receipt')
                                                          const startOrder = editExecAttachments.length
                                                          const newAttachments = results.map((img, idx) => ({
                                                            ...img,
                                                            order: startOrder + idx,
                                                          }))
                                                          setEditExecAttachments([...editExecAttachments, ...newAttachments])
                                                          setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
                                                        } catch (err) {
                                                          console.error('Upload failed:', err)
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm"
                                                onClick={async () => {
                                                  const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
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
                                                    setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
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
                                                onClick={() => {
                                                  const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
                                                  setEditingExecutionId(null)
                                                  setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
                                                }}
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
                                              <div
                                                className="overflow-x-auto -mx-3 px-3 snap-x snap-mandatory md:snap-none"
                                                style={{ WebkitOverflowScrolling: 'touch' }}
                                              >
                                                <div className="flex gap-3 md:gap-3" style={{ width: 'max-content' }}>
                                                  {execution.attachments.map((att, attIdx) => (
                                                    <div key={attIdx} className="flex-shrink-0 snap-center w-[90vw] md:w-auto flex items-center justify-center">
                                                      {att.mimeType === "application/pdf" ? (
                                                        <PDFPageViewer
                                                          url={att.originalUrl}
                                                          pageHeight="55vh"
                                                        />
                                                      ) : (
                                                        <button
                                                          type="button"
                                                          onClick={() => setPreviewFile({
                                                            url: att.originalUrl,
                                                            type: att.mimeType,
                                                            name: att.fileName
                                                          })}
                                                          className="hover:opacity-80 transition-opacity"
                                                        >
                                                          <img
                                                            src={att.thumbnailUrl || att.originalUrl}
                                                            alt=""
                                                            className="h-[55vh] w-auto max-w-[90vw] md:max-w-none object-contain rounded"
                                                          />
                                                        </button>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        )}

                                        {execution.verificationStatus === "rejected" && execution.rejectReason && (
                                          <div className="mt-2 text-xs text-destructive">
                                            退回原因：{execution.rejectReason}
                                          </div>
                                        )}

                                        {/* Inline verify buttons for pending executions */}
                                        {execution.verificationStatus === "pending" && (user?.role === "super_admin" || step.verifierUserIds?.includes(user?.id || "")) && (
                                          <div className="mt-3 pt-3 border-t flex gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                                              onClick={async () => {
                                                if (!user) return
                                                setIsProcessing(true)
                                                try {
                                                  await workflowService.verifyExecution(execution.id, user.id, true)
                                                  if (selectedProject) {
                                                    const currentStep = selectedProject.workflow[selectedProject.currentStep]
                                                    if (currentStep) {
                                                      await projectService.advanceWorkflow(selectedProject.id, currentStep.id, user.id, true)
                                                    }
                                                    await Promise.all([
                                                      loadProjectExecutions(selectedProject.id),
                                                      loadData()
                                                    ])
                                                  }
                                                } catch (error) {
                                                  console.error("Failed to verify:", error)
                                                } finally {
                                                  setIsProcessing(false)
                                                }
                                              }}
                                              disabled={isProcessing}
                                            >
                                              <CheckCircle className="h-4 w-4 mr-1" />
                                              通過
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                                              onClick={() => {
                                                setSelectedExecution(execution)
                                                setVerifyForm({ approved: false, rejectReason: "" })
                                                setIsVerifyDialogOpen(true)
                                              }}
                                              disabled={isProcessing}
                                            >
                                              <XCircle className="h-4 w-4 mr-1" />
                                              退回
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  </div>
                                </div>
                              )}

                              {/* 評議委員會步驟 - 顯示已儲存的資料 */}
                              {step.name.includes("評議委員會") && step.note && step.status === "approved" && (
                                <div className="space-y-4 border-t pt-3 mt-3">
                                  {(() => {
                                    try {
                                      const data = JSON.parse(step.note)
                                      return (
                                        <>
                                          {/* 會議日期 */}
                                          {data.meetingDate && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">會議日期</Label>
                                              <div className="text-sm font-medium">{data.meetingDate}</div>
                                            </div>
                                          )}

                                          {/* 補助用途 */}
                                          {data.purposes && data.purposes.length > 0 && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">補助用途</Label>
                                              <div className="text-sm font-medium">{data.purposes.join('、')}</div>
                                            </div>
                                          )}

                                          {/* 補助類型 */}
                                          {data.subsidyType && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">補助類型</Label>
                                              <div className="text-sm font-medium">
                                                {data.subsidyType === 'oneTime' ? '一次性' : '期間性'}
                                              </div>
                                            </div>
                                          )}

                                          {/* 一次性補助資訊 */}
                                          {data.subsidyType === 'oneTime' && (
                                            <>
                                              {data.oneTimeMonth && (
                                                <div>
                                                  <Label className="text-muted-foreground text-xs">補助月份</Label>
                                                  <div className="text-sm font-medium">{data.oneTimeMonth}</div>
                                                </div>
                                              )}
                                              {data.oneTimeAmount && (
                                                <div>
                                                  <Label className="text-muted-foreground text-xs">補助金額</Label>
                                                  <div className="text-sm font-medium">新台幣 {data.oneTimeAmount} 元整</div>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {/* 期間性補助資訊 */}
                                          {data.subsidyType === 'periodic' && (
                                            <>
                                              {/* 補助期間 */}
                                              {(data.periodStart || data.periodEnd) && (
                                                <div>
                                                  <Label className="text-muted-foreground text-xs">補助期間</Label>
                                                  <div className="text-sm font-medium">{data.periodStart} 至 {data.periodEnd}</div>
                                                </div>
                                              )}

                                              {/* 補助頻率 */}
                                              {data.frequency && (
                                                <div>
                                                  <Label className="text-muted-foreground text-xs">補助頻率</Label>
                                                  <div className="text-sm font-medium">
                                                    {data.frequency === 'monthly' ? '每月' : `每 ${data.periodicMonths} 月為一期`}
                                                  </div>
                                                </div>
                                              )}

                                              {/* 每期金額 */}
                                              {data.periodicAmount && (
                                                <div>
                                                  <Label className="text-muted-foreground text-xs">
                                                    {data.frequency === 'monthly' ? '每月金額' : '每期金額'}
                                                  </Label>
                                                  <div className="text-sm font-medium">
                                                    新台幣 {data.periodicAmount} 元整
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </>
                                      )
                                    } catch {
                                      return <div className="text-sm text-muted-foreground">{step.note}</div>
                                    }
                                  })()}
                                </div>
                              )}

                              {/* 結案與追蹤步驟 - 顯示已儲存的資料 */}
                              {step.name.includes("結案") && step.note && step.status === "approved" && (
                                <div className="space-y-4 border-t pt-3 mt-3">
                                  {(() => {
                                    try {
                                      const data = JSON.parse(step.note)
                                      // 從評議委員會步驟讀取補助類型
                                      const committeeStep = selectedProject?.workflow.find(s => s.name.includes("評議委員會"))
                                      let subsidyData: { subsidyType?: string } = {}
                                      try {
                                        if (committeeStep?.note) {
                                          subsidyData = JSON.parse(committeeStep.note)
                                        }
                                      } catch {}

                                      return (
                                        <>
                                          {/* 匯款日期 - 一次性 */}
                                          {subsidyData.subsidyType === 'oneTime' && data.paymentDate && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">匯款日期</Label>
                                              <div className="text-sm font-medium">{data.paymentDate}</div>
                                            </div>
                                          )}

                                          {/* 追蹤日期 - 期間性 */}
                                          {subsidyData.subsidyType === 'periodic' && data.trackingDates && data.trackingDates.length > 0 && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">追蹤日期</Label>
                                              <div className="space-y-1">
                                                {data.trackingDates.map((td: { date: string; completed: boolean }, idx: number) => (
                                                  <div key={idx} className="text-sm font-medium flex items-center gap-2">
                                                    <span>{td.date}</span>
                                                    {td.completed && <span className="text-green-600">✓</span>}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )
                                    } catch {
                                      return <div className="text-sm text-muted-foreground">{step.note}</div>
                                    }
                                  })()}
                                </div>
                              )}

                              {/* 審核步驟的通過/不通過勾選 */}
                              {step.type === "establishment" && step.status === "in_progress" && selectedProject.status === "active" && (
                                <div className="border-t pt-3 mt-3">
                                  <div className="space-y-3">
                                    <Label>審核結果</Label>
                                    <div className="flex items-center gap-6">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`review-${step.id}`}
                                          value="approved"
                                          checked={reviewResult[step.id] === 'approved'}
                                          className="w-4 h-4 accent-primary"
                                          onChange={() => setReviewResult(prev => ({ ...prev, [step.id]: 'approved' }))}
                                        />
                                        <span className="text-sm">通過</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`review-${step.id}`}
                                          value="rejected"
                                          checked={reviewResult[step.id] === 'rejected'}
                                          className="w-4 h-4 accent-primary"
                                          onChange={() => setReviewResult(prev => ({ ...prev, [step.id]: 'rejected' }))}
                                        />
                                        <span className="text-sm">不通過</span>
                                      </label>
                                    </div>
                                    {reviewResult[step.id] === 'rejected' && (
                                      <div className="space-y-2">
                                        <Label className="text-sm">不通過原因</Label>
                                        <textarea
                                          id={`review-reason-text-${step.id}`}
                                          className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                          placeholder="請填寫不通過原因..."
                                        />
                                      </div>
                                    )}
                                    <Button
                                      className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={!reviewResult[step.id] || isProcessing}
                                      onClick={async () => {
                                        if (!selectedProject || !user) return
                                        const result = reviewResult[step.id]

                                        if (!result) {
                                          alert("請選擇審核結果")
                                          return
                                        }

                                        if (result === "rejected") {
                                          const reasonText = (document.getElementById(`review-reason-text-${step.id}`) as HTMLTextAreaElement)?.value
                                          if (!reasonText?.trim()) {
                                            alert("請填寫不通過原因")
                                            return
                                          }
                                        }

                                          setIsProcessing(true)
                                          try {
                                            const newWorkflow = [...selectedProject.workflow]
                                            const currentStep = newWorkflow[originalIndex]
                                            const reasonText = (document.getElementById(`review-reason-text-${step.id}`) as HTMLTextAreaElement)?.value

                                            if (result === "approved") {
                                              // 通過：更新當前步驟狀態，進入下一步
                                              currentStep.status = "approved"
                                              currentStep.approvedBy = user.id
                                              currentStep.approvedAt = new Date().toISOString()

                                              // 啟動下一步
                                              const nextStepIndex = originalIndex + 1
                                              if (nextStepIndex < newWorkflow.length) {
                                                newWorkflow[nextStepIndex].status = "in_progress"
                                              }

                                              await projectService.updateProject(selectedProject.id, {
                                                workflow: newWorkflow,
                                                currentStep: nextStepIndex,
                                              })
                                            } else {
                                              // 不通過：更新步驟狀態，個案設為不成立
                                              currentStep.status = "not_established"
                                              currentStep.approvedBy = user.id
                                              currentStep.approvedAt = new Date().toISOString()
                                              currentStep.note = reasonText || ""

                                              await projectService.updateProject(selectedProject.id, {
                                                workflow: newWorkflow,
                                                status: "not_established",
                                              })
                                            }

                                            await loadData()
                                            const updated = await projectService.getProjectById(selectedProject.id)
                                            if (updated) setSelectedProject(updated)
                                          } catch (error) {
                                            console.error("Failed to submit review:", error)
                                            alert("送出失敗，請稍後再試")
                                          } finally {
                                            setIsProcessing(false)
                                          }
                                        }}
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        {isProcessing ? "送出中..." : "送出審核結果"}
                                      </Button>
                                  </div>
                                </div>
                              )}

                              {/* Execution form for approval steps */}
                              {userCanExecute && selectedProject.status === "active" && (
                                <div key={`exec-form-${step.id}`} className="border-t pt-3 mt-3">
                                  <div className="space-y-4">
                                    {/* 評議委員會步驟的特殊表單 */}
                                    {step.name.includes("評議委員會") ? (
                                      <>
                                        {/* 評議委員會 PDF 附件 - 水平滾動 */}
                                        <div className="space-y-2">
                                          <Label>評議委員會文件</Label>
                                          <div
                                            className="overflow-x-auto -mx-4 px-4 snap-x snap-mandatory md:snap-none"
                                            style={{ WebkitOverflowScrolling: 'touch' }}
                                          >
                                            <div className="flex gap-4 items-start" style={{ width: 'max-content' }}>
                                              {committeeAttachments.map((attachment) => (
                                                <div key={attachment.id} className="flex-shrink-0 snap-center w-[90vw] md:w-auto flex items-center justify-center">
                                                  {attachment.mimeType === "application/pdf" ? (
                                                    <PDFPageViewer
                                                      url={attachment.originalUrl}
                                                      pageHeight="50vh"
                                                    />
                                                  ) : (
                                                    <img
                                                      src={attachment.thumbnailUrl || attachment.originalUrl}
                                                      alt={attachment.fileName}
                                                      className="h-[50vh] w-auto max-w-[90vw] md:max-w-none object-contain rounded"
                                                    />
                                                  )}
                                                </div>
                                              ))}
                                              {/* 上傳按鈕 */}
                                              <div className="flex-shrink-0 snap-center h-[50vh] w-[90vw] md:w-[180px] flex items-center justify-center">
                                                <DropZone
                                                  accept="image/*,application/pdf"
                                                  multiple
                                                  className="h-full w-full md:w-[180px]"
                                                  onFilesSelected={async (files) => {
                                                    const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
                                                    const validFiles = files.filter(file => {
                                                      const validation = validateFile(file, 'receipt')
                                                      return validation.valid
                                                    })
                                                    if (validFiles.length === 0) return
                                                    try {
                                                      const results = await imageService.uploadMultiple(validFiles, 'receipt')
                                                      const startOrder = committeeAttachments.length
                                                      const newAttachments = results.map((img, idx) => ({
                                                        ...img,
                                                        order: startOrder + idx,
                                                      }))
                                                      setCommitteeAttachments([...committeeAttachments, ...newAttachments])
                                                      setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
                                                    } catch (err) {
                                                      console.error('Upload failed:', err)
                                                    }
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* 補助用途 - 自動帶入個案類型 */}
                                        <div className="space-y-2">
                                          <Label>補助用途</Label>
                                          <div className="flex flex-wrap gap-3">
                                            {['急難救助', '醫療補助', '教育扶助', '喪葬補助', '生活扶助'].map((purpose) => {
                                              // 預設勾選個案的補助類型
                                              const isDefaultChecked = selectedProject?.projectType === purpose
                                              const isChecked = committeeForm.purposes.length > 0
                                                ? committeeForm.purposes.includes(purpose)
                                                : isDefaultChecked
                                              return (
                                                <label key={purpose} className="flex items-center gap-2 cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        setCommitteeForm(prev => ({ ...prev, purposes: [...prev.purposes, purpose] }))
                                                      } else {
                                                        setCommitteeForm(prev => ({ ...prev, purposes: prev.purposes.filter(p => p !== purpose) }))
                                                      }
                                                    }}
                                                    className="w-4 h-4 accent-primary"
                                                  />
                                                  <span className="text-sm">{purpose}</span>
                                                </label>
                                              )
                                            })}
                                          </div>
                                        </div>

                                        {/* 補助類型選擇 */}
                                        <div className="space-y-2">
                                          <Label>補助類型</Label>
                                          <div className="flex items-center gap-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                              <input
                                                type="radio"
                                                name={`subsidy-type-${step.id}`}
                                                checked={committeeForm.subsidyType === 'oneTime'}
                                                onChange={() => setCommitteeForm(prev => ({ ...prev, subsidyType: 'oneTime' }))}
                                                className="w-4 h-4 accent-primary"
                                              />
                                              <span className="text-sm">一次性</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                              <input
                                                type="radio"
                                                name={`subsidy-type-${step.id}`}
                                                checked={committeeForm.subsidyType === 'periodic'}
                                                onChange={() => setCommitteeForm(prev => ({ ...prev, subsidyType: 'periodic' }))}
                                                className="w-4 h-4 accent-primary"
                                              />
                                              <span className="text-sm">期間性</span>
                                            </label>
                                          </div>
                                        </div>

                                        {/* 一次性：月份和金額 */}
                                        {committeeForm.subsidyType === 'oneTime' && (
                                          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                            <div className="space-y-2">
                                              <Label>補助月份</Label>
                                              <Input
                                                type="month"
                                                id={`oneTimeMonth-${step.id}`}
                                                defaultValue={committeeForm.oneTimeMonth}
                                                className="w-40"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>補助金額</Label>
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">新台幣</span>
                                                <Input
                                                  type="text"
                                                  inputMode="numeric"
                                                  placeholder="金額"
                                                  id={`oneTimeAmount-${step.id}`}
                                                  defaultValue={committeeForm.oneTimeAmount}
                                                  className="w-32"
                                                />
                                                <span className="text-sm text-muted-foreground">元整</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* 期間性：顯示期間、頻率、每期金額 */}
                                        {committeeForm.subsidyType === 'periodic' && (
                                          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                            {/* 補助期間 */}
                                            <div className="space-y-2">
                                              <Label>補助期間</Label>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Input
                                                  type="date"
                                                  id={`periodStart-${step.id}`}
                                                  defaultValue={committeeForm.periodStart}
                                                  className="w-40"
                                                />
                                                <span className="text-sm text-muted-foreground">至</span>
                                                <Input
                                                  type="date"
                                                  id={`periodEnd-${step.id}`}
                                                  defaultValue={committeeForm.periodEnd}
                                                  className="w-40"
                                                />
                                              </div>
                                            </div>

                                            {/* 補助頻率 */}
                                            <div className="space-y-2">
                                              <Label>補助頻率</Label>
                                              <div className="flex items-center gap-4 flex-wrap">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                  <input
                                                    type="radio"
                                                    name={`frequency-${step.id}`}
                                                    id={`frequency-monthly-${step.id}`}
                                                    defaultChecked={committeeForm.frequency === 'monthly'}
                                                    className="w-4 h-4 accent-primary"
                                                  />
                                                  <span className="text-sm">每月</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                  <input
                                                    type="radio"
                                                    name={`frequency-${step.id}`}
                                                    id={`frequency-periodic-${step.id}`}
                                                    defaultChecked={committeeForm.frequency === 'periodic'}
                                                    className="w-4 h-4 accent-primary"
                                                  />
                                                  <span className="text-sm">每</span>
                                                  <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    id={`periodicMonths-${step.id}`}
                                                    defaultValue={committeeForm.periodicMonths}
                                                    className="w-12 h-8 text-center"
                                                    placeholder="_"
                                                  />
                                                  <span className="text-sm">月為一期</span>
                                                </label>
                                              </div>
                                            </div>

                                            {/* 每期金額 */}
                                            <div className="space-y-2">
                                              <Label>每期金額</Label>
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">新台幣</span>
                                                <Input
                                                  type="text"
                                                  inputMode="numeric"
                                                  placeholder="金額"
                                                  id={`periodicAmount-${step.id}`}
                                                  defaultValue={committeeForm.periodicAmount}
                                                  className="w-32"
                                                />
                                                <span className="text-sm text-muted-foreground">元整</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    ) : step.name.includes("結案") ? (
                                      /* 結案與追蹤步驟的表單 - 只有一次性需要顯示 */
                                      (() => {
                                        // 從評議委員會步驟讀取補助類型
                                        const committeeStep = selectedProject?.workflow.find(s => s.name.includes("評議委員會"))
                                        let subsidyData: { subsidyType?: string; oneTimeMonth?: string; oneTimeAmount?: string; periodStart?: string; periodEnd?: string; frequency?: string; periodicMonths?: string; periodicAmount?: string } = {}
                                        try {
                                          if (committeeStep?.note) {
                                            subsidyData = JSON.parse(committeeStep.note)
                                          }
                                        } catch {}
                                        const isOneTime = subsidyData.subsidyType === 'oneTime'
                                        const isPeriodic = subsidyData.subsidyType === 'periodic'

                                        // 期間性不需要顯示表單（直接 100%）
                                        if (isPeriodic) {
                                          return (
                                            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
                                              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                              <div className="font-medium text-green-800 dark:text-green-200">期間性補助進行中</div>
                                              <div className="text-sm text-muted-foreground mt-1">
                                                補助期間：{subsidyData.periodStart} 至 {subsidyData.periodEnd}
                                              </div>
                                              <div className="text-xs text-muted-foreground mt-1">
                                                請使用「個案追蹤」功能管理追蹤進度
                                              </div>
                                            </div>
                                          )
                                        }

                                        // 一次性：顯示匯款日期 + 附件
                                        return (
                                          <>
                                            {/* 顯示補助摘要 */}
                                            {isOneTime && (
                                              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                                                <div className="font-medium mb-1">補助類型：一次性</div>
                                                {subsidyData.oneTimeAmount && (
                                                  <div className="text-muted-foreground">
                                                    補助金額：新台幣 {Number(subsidyData.oneTimeAmount).toLocaleString()} 元整
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {/* 一次性：匯款日期 */}
                                            <div className="space-y-2">
                                              <Label>匯款日期</Label>
                                              <Input
                                                type="date"
                                                id={`paymentDate-${step.id}`}
                                                defaultValue={closingForm.paymentDate}
                                                className="w-40"
                                              />
                                            </div>

                                            {/* 一次性：附件 - 水平滾動 */}
                                            <div className="space-y-2">
                                              <Label>附件</Label>
                                              <div
                                                className="overflow-x-auto -mx-4 px-4 snap-x snap-mandatory md:snap-none"
                                                style={{ WebkitOverflowScrolling: 'touch' }}
                                              >
                                                <div className="flex gap-4 items-start" style={{ width: 'max-content' }}>
                                                  {closingAttachments.map((attachment) => (
                                                    <div key={attachment.id} className="flex-shrink-0 snap-center w-[90vw] md:w-auto flex items-center justify-center">
                                                      {attachment.mimeType === "application/pdf" ? (
                                                        <PDFPageViewer
                                                          url={attachment.originalUrl}
                                                          pageHeight="40vh"
                                                        />
                                                      ) : (
                                                        <img
                                                          src={attachment.thumbnailUrl || attachment.originalUrl}
                                                          alt={attachment.fileName}
                                                          className="h-[40vh] w-auto max-w-[90vw] md:max-w-none object-contain rounded"
                                                        />
                                                      )}
                                                    </div>
                                                  ))}
                                                  <div className="flex-shrink-0 snap-center h-[40vh] w-[90vw] md:w-[150px] flex items-center justify-center">
                                                    <DropZone
                                                      accept="image/*,application/pdf"
                                                      multiple
                                                      className="h-full w-full md:w-[150px]"
                                                      onFilesSelected={async (files) => {
                                                        const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
                                                        const validFiles = files.filter(file => {
                                                          const validation = validateFile(file, 'receipt')
                                                          return validation.valid
                                                        })
                                                        if (validFiles.length === 0) return
                                                        try {
                                                          const results = await imageService.uploadMultiple(validFiles, 'receipt')
                                                          const startOrder = closingAttachments.length
                                                          const newAttachments = results.map((img, idx) => ({
                                                            ...img,
                                                            order: startOrder + idx,
                                                          }))
                                                          setClosingAttachments([...closingAttachments, ...newAttachments])
                                                          setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
                                                        } catch (err) {
                                                          console.error('Upload failed:', err)
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </>
                                        )
                                      })()
                                    ) : !step.name.includes("評估") && (
                                      /* 其他步驟的一般表單 */
                                      <>
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
                                          <div
                                            className="mt-1 overflow-x-auto -mx-4 px-4 snap-x snap-mandatory md:snap-none"
                                            style={{ WebkitOverflowScrolling: 'touch' }}
                                          >
                                            <div className="flex gap-4 items-start" style={{ width: 'max-content' }}>
                                              {inlineExecAttachments.map((attachment) => (
                                                <div key={attachment.id} className="flex-shrink-0 snap-center w-[90vw] md:w-auto flex items-center justify-center">
                                                  {attachment.mimeType === "application/pdf" ? (
                                                    <PDFPageViewer
                                                      url={attachment.originalUrl}
                                                      pageHeight="40vh"
                                                    />
                                                  ) : (
                                                    <img
                                                      src={attachment.thumbnailUrl || attachment.originalUrl}
                                                      alt={attachment.fileName}
                                                      className="h-[40vh] w-auto max-w-[90vw] md:max-w-none object-contain rounded"
                                                    />
                                                  )}
                                                </div>
                                              ))}
                                              <div className="flex-shrink-0 snap-center h-[40vh] w-[90vw] md:w-[150px] flex items-center justify-center">
                                                <DropZone
                                                  accept="image/*,application/pdf"
                                                  multiple
                                                  className="h-full w-full md:w-[150px]"
                                                  onFilesSelected={async (files) => {
                                                    const container = projectDetailScrollRef.current; const scrollTop = container?.scrollTop || 0
                                                    const validFiles = files.filter(file => {
                                                      const validation = validateFile(file, 'receipt')
                                                      return validation.valid
                                                    })
                                                    if (validFiles.length === 0) return
                                                    try {
                                                      const results = await imageService.uploadMultiple(validFiles, 'receipt')
                                                      const startOrder = inlineExecAttachments.length
                                                      const newAttachments = results.map((img, idx) => ({
                                                        ...img,
                                                        order: startOrder + idx,
                                                      }))
                                                      setInlineExecAttachments([...inlineExecAttachments, ...newAttachments])
                                                      setTimeout(() => { if (projectDetailScrollRef.current) projectDetailScrollRef.current.scrollTop = scrollTop }, 100)
                                                    } catch (err) {
                                                      console.error('Upload failed:', err)
                                                    }
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                    {/* 結案步驟：檢查補助類型決定是否顯示按鈕 */}
                                    {(() => {
                                      // 期間性結案不顯示按鈕
                                      if (step.name.includes("結案")) {
                                        const committeeStep = selectedProject?.workflow.find(s => s.name.includes("評議委員會"))
                                        let subsidyData: { subsidyType?: string } = {}
                                        try {
                                          if (committeeStep?.note) {
                                            subsidyData = JSON.parse(committeeStep.note)
                                          }
                                        } catch {}
                                        if (subsidyData.subsidyType === 'periodic') {
                                          return null // 期間性不顯示按鈕
                                        }
                                      }
                                      return (
                                        <Button
                                          id={step.name.includes("評估") ? `eval-submit-${step.id}` : undefined}
                                          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                          onClick={async () => {
                                            if (!selectedProject || !user) return
                                            const currentStep = selectedProject.workflow[selectedProject.currentStep]
                                            if (!currentStep) return

                                            setIsProcessing(true)
                                            try {
                                              if (step.name.includes("評估")) {
                                            // 評估表：直接送出，收集預期金額
                                            const newWorkflow = [...selectedProject.workflow]
                                            const evalStep = newWorkflow[selectedProject.currentStep]

                                            // 收集預期金額
                                            const budgetInput = document.querySelector(`input[data-budget-input="${step.id}"]`) as HTMLInputElement
                                            if (budgetInput && budgetInput.value) {
                                              evalStep.note = budgetInput.value
                                            }

                                            evalStep.status = "approved"
                                            evalStep.approvedAt = new Date().toISOString()

                                            // 啟動下一步
                                            const nextStepIndex = selectedProject.currentStep + 1
                                            if (nextStepIndex < newWorkflow.length) {
                                              newWorkflow[nextStepIndex].status = "in_progress"
                                            }

                                            await projectService.updateProject(selectedProject.id, {
                                              workflow: newWorkflow,
                                              currentStep: nextStepIndex,
                                            })
                                          } else if (step.name.includes("評議委員會")) {
                                            // 評議委員會：儲存會議結果
                                            const newWorkflow = [...selectedProject.workflow]
                                            const committeeStep = newWorkflow[selectedProject.currentStep]

                                            // 取得會議日期（從 subTask[0].note，由評估表設定）
                                            const meetingDate = committeeStep.subTasks?.[0]?.note || ''

                                            // 取得補助用途（優先用表單值，否則用個案類型）
                                            const purposes = committeeForm.purposes.length > 0
                                              ? committeeForm.purposes
                                              : selectedProject.projectType ? [selectedProject.projectType] : []

                                            // 從 DOM 收集表單資料
                                            const oneTimeMonth = (document.getElementById(`oneTimeMonth-${step.id}`) as HTMLInputElement)?.value || ''
                                            const oneTimeAmount = (document.getElementById(`oneTimeAmount-${step.id}`) as HTMLInputElement)?.value || ''
                                            const periodStart = (document.getElementById(`periodStart-${step.id}`) as HTMLInputElement)?.value || ''
                                            const periodEnd = (document.getElementById(`periodEnd-${step.id}`) as HTMLInputElement)?.value || ''
                                            const isMonthly = (document.getElementById(`frequency-monthly-${step.id}`) as HTMLInputElement)?.checked
                                            const frequency = isMonthly ? 'monthly' : 'periodic'
                                            const periodicMonths = (document.getElementById(`periodicMonths-${step.id}`) as HTMLInputElement)?.value || ''
                                            const periodicAmount = (document.getElementById(`periodicAmount-${step.id}`) as HTMLInputElement)?.value || ''

                                            // 儲存表單資料到 step.note
                                            committeeStep.note = JSON.stringify({
                                              meetingDate,
                                              purposes,
                                              subsidyType: committeeForm.subsidyType,
                                              oneTimeMonth,
                                              oneTimeAmount,
                                              periodStart,
                                              periodEnd,
                                              frequency: committeeForm.subsidyType === 'periodic' ? frequency : '',
                                              periodicMonths,
                                              periodicAmount,
                                            })

                                            // 儲存附件
                                            committeeStep.attachments = committeeAttachments.map(att => ({
                                              id: att.id,
                                              originalUrl: att.originalUrl,
                                              thumbnailUrl: att.thumbnailUrl,
                                              fileName: att.fileName,
                                              fileSize: att.fileSize,
                                              mimeType: att.mimeType,
                                              order: att.order,
                                            }))

                                            committeeStep.status = "approved"
                                            committeeStep.approvedAt = new Date().toISOString()

                                            // 啟動下一步
                                            const nextStepIndex = selectedProject.currentStep + 1
                                            if (nextStepIndex < newWorkflow.length) {
                                              newWorkflow[nextStepIndex].status = "in_progress"
                                            }

                                            await projectService.updateProject(selectedProject.id, {
                                              workflow: newWorkflow,
                                              currentStep: nextStepIndex,
                                            })

                                            // 重置表單
                                            setCommitteeForm({
                                              meetingDate: '',
                                              purposes: [],
                                              subsidyType: '',
                                              oneTimeMonth: '',
                                              oneTimeAmount: '',
                                              periodStart: '',
                                              periodEnd: '',
                                              frequency: '',
                                              periodicMonths: '',
                                              periodicAmount: '',
                                            })
                                            setCommitteeAttachments([])
                                          } else if (step.name.includes("文件寄發")) {
                                            // 文件寄發及簽核：直接完成，不需要驗收
                                            const newWorkflow = [...selectedProject.workflow]
                                            const docStep = newWorkflow[selectedProject.currentStep]

                                            // 儲存說明
                                            if (inlineExecContentRef.current?.value) {
                                              docStep.note = inlineExecContentRef.current.value
                                            }

                                            // 儲存附件
                                            if (inlineExecAttachments.length > 0) {
                                              docStep.attachments = inlineExecAttachments.map(att => ({
                                                id: att.id,
                                                originalUrl: att.originalUrl,
                                                thumbnailUrl: att.thumbnailUrl,
                                                fileName: att.fileName,
                                                fileSize: att.fileSize,
                                                mimeType: att.mimeType,
                                                order: att.order,
                                              }))
                                            }

                                            docStep.status = "approved"
                                            docStep.approvedAt = new Date().toISOString()

                                            // 檢查補助類型
                                            const committeeStep = newWorkflow.find(s => s.name.includes("評議委員會"))
                                            let subsidyType = ''
                                            try {
                                              if (committeeStep?.note) {
                                                const data = JSON.parse(committeeStep.note)
                                                subsidyType = data.subsidyType || ''
                                              }
                                            } catch {}

                                            // 啟動下一步
                                            const nextStepIndex = selectedProject.currentStep + 1

                                            if (subsidyType === 'periodic' && nextStepIndex < newWorkflow.length) {
                                              // 期間性補助：結案步驟也自動完成
                                              const closingStep = newWorkflow[nextStepIndex]
                                              closingStep.status = "approved"
                                              closingStep.approvedAt = new Date().toISOString()
                                              closingStep.note = JSON.stringify({ subsidyType: 'periodic' })

                                              // 個案維持進行中狀態（追蹤中）
                                              await projectService.updateProject(selectedProject.id, {
                                                workflow: newWorkflow,
                                                currentStep: nextStepIndex,
                                              })
                                            } else {
                                              // 一次性補助：正常啟動結案步驟
                                              if (nextStepIndex < newWorkflow.length) {
                                                newWorkflow[nextStepIndex].status = "in_progress"
                                              }

                                              await projectService.updateProject(selectedProject.id, {
                                                workflow: newWorkflow,
                                                currentStep: nextStepIndex,
                                              })
                                            }

                                            // 重置表單
                                            if (inlineExecContentRef.current) inlineExecContentRef.current.value = ""
                                            setInlineExecAttachments([])
                                          } else if (step.name.includes("結案")) {
                                            // 結案與追蹤：儲存匯款日期或追蹤日期，完成個案
                                            const newWorkflow = [...selectedProject.workflow]
                                            const closingStep = newWorkflow[selectedProject.currentStep]

                                            // 從 DOM 收集匯款日期
                                            const paymentDate = (document.getElementById(`paymentDate-${step.id}`) as HTMLInputElement)?.value || ''

                                            // 儲存表單資料到 step.note
                                            closingStep.note = JSON.stringify({
                                              paymentDate,
                                              trackingDates: closingForm.trackingDates,
                                            })

                                            // 儲存附件
                                            if (closingAttachments.length > 0) {
                                              closingStep.attachments = closingAttachments.map(att => ({
                                                id: att.id,
                                                originalUrl: att.originalUrl,
                                                thumbnailUrl: att.thumbnailUrl,
                                                fileName: att.fileName,
                                                fileSize: att.fileSize,
                                                mimeType: att.mimeType,
                                                order: att.order,
                                              }))
                                            }

                                            closingStep.status = "approved"
                                            closingStep.approvedAt = new Date().toISOString()

                                            // 更新個案狀態為已完成
                                            await projectService.updateProject(selectedProject.id, {
                                              workflow: newWorkflow,
                                              currentStep: selectedProject.currentStep,
                                              status: "completed",
                                            })

                                            // 重置表單
                                            setClosingForm({ paymentDate: '', trackingDates: [] })
                                            setClosingAttachments([])
                                          } else {
                                            // 其他步驟：使用執行流程
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
                                          }
                                          // Refresh project data
                                          await loadData()
                                          const updated = await projectService.getProjectById(selectedProject.id)
                                          if (updated) setSelectedProject(updated)
                                        } catch (error) {
                                          console.error("Failed to submit:", error)
                                          alert("提交失敗，請稍後再試")
                                        } finally {
                                          setIsProcessing(false)
                                        }
                                      }}
                                          disabled={isProcessing}
                                        >
                                          {step.name.includes("結案") ? (
                                            <>
                                              <Check className="h-4 w-4 mr-2" />
                                              {isProcessing ? "結案中..." : "結案"}
                                            </>
                                          ) : (
                                            <>
                                              <Send className="h-4 w-4 mr-2" />
                                              {isProcessing ? "送出中..." : "送出"}
                                            </>
                                          )}
                                        </Button>
                                      )
                                    })()}
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
                      <p>尚無個案內容</p>
                    </div>
                  )}
                </CardContent>
              </Card>

          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:h-[calc(100vh-8rem)] md:overflow-hidden">
      {/* Page Header - includes plan selector when plan is selected */}
      <div className="mb-4 shrink-0">
        {!selectedPlan ? (
          // Normal header when no plan selected
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">計畫管理</h1>
              <p className="text-muted-foreground">管理計畫與個案流程</p>
            </div>
          </div>
        ) : (
          // Plan selector header when plan is selected - hide on mobile when viewing projects/detail
          <div className={cn("space-y-2", mobileView !== "plans" && "hidden md:block")}>
            <div className="flex items-center gap-4">
              {/* Back button */}
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedPlan(null)
                  setSelectedProject(null)
                  setMobileView("plans")
                }}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>

              {/* All plans horizontal scroll */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-1">
                    {filteredPlans.map((plan) => {
                      const isSelected = selectedPlan?.id === plan.id
                      return (
                        <div
                          key={plan.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap shrink-0",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          )}
                          onClick={() => handleSelectPlan(plan)}
                        >
                          {/* Thumbnail */}
                          <div className="w-7 h-7 rounded overflow-hidden bg-background/20 shrink-0">
                            {plan.coverImage ? (
                              <img
                                src={plan.coverImage.thumbnailUrl || plan.coverImage.originalUrl}
                                alt={plan.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FolderKanban className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium">{plan.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Actions for selected plan */}
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => openPlanView(selectedPlan)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  查看計畫
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Layout: Top cards + Bottom two columns */}
      {/* Desktop: Card with fixed layout */}
      <Card className="hidden md:flex flex-1 overflow-hidden flex-col">
        {/* Top: Plan Cards - only show when no plan selected */}
        {!selectedPlan && <PlansCards />}

        {/* Bottom: Two columns (Projects + Detail) */}
        {selectedPlan && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Projects list */}
            <div className="w-[20%] border-r overflow-hidden">
              <ProjectsColumn />
            </div>
            {/* Right: Project detail */}
            <div className="flex-1 overflow-hidden">
              {ProjectDetailColumn()}
            </div>
          </div>
        )}
      </Card>

      {/* Mobile: No Card wrapper, natural flow */}
      <div className="md:hidden pb-20">
        {mobileView === "plans" && <PlansCards />}
        {mobileView === "projects" && <ProjectsColumn />}
        {mobileView === "detail" && ProjectDetailColumn()}
      </div>

      {/* Plan Form Dialog */}
      <Dialog open={isPlanFormOpen} onOpenChange={setIsPlanFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "編輯計畫" : "新增計畫"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Tab 切換 */}
            <div className="flex border-b -mx-6 px-6">
              <button
                type="button"
                className={cn(
                  "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
                  planFormMode === 'basic'
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setPlanFormMode('basic')}
              >
                基本資訊
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
                  planFormMode === 'intro'
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setPlanFormMode('intro')}
              >
                前台介紹
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
                  planFormMode === 'workflow'
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setPlanFormMode('workflow')}
              >
                流程編輯
              </button>
            </div>

            {/* 基本資訊模式 */}
            {planFormMode === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
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
                    <Label>代號</Label>
                    <Input
                      value={planFormData.code}
                      onChange={(e) =>
                        setPlanFormData({ ...planFormData, code: e.target.value.toUpperCase() })
                      }
                      placeholder="例如：JL"
                      maxLength={10}
                    />
                  </div>
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
                <div className="space-y-2">
                  <Label>計畫描述</Label>
                  <textarea
                    className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={planFormData.description}
                    onChange={(e) =>
                      setPlanFormData({ ...planFormData, description: e.target.value })
                    }
                    placeholder="描述計畫目標...&#10;可以換行輸入多行內容"
                  />
                  <p className="text-xs text-muted-foreground">支援換行，會在卡片上顯示</p>
                </div>
              </div>
            )}

            {/* 前台介紹模式 */}
            {planFormMode === 'intro' && (
              <div className="space-y-5">
                {/* 公開開關 */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label htmlFor="isPublic" className="cursor-pointer font-medium">
                      公開到首頁
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      開啟後此計畫將顯示在首頁的公益計畫區塊
                    </p>
                  </div>
                  <Checkbox
                    id="isPublic"
                    checked={planFormData.isPublic}
                    onCheckedChange={(checked) =>
                      setPlanFormData({ ...planFormData, isPublic: !!checked })
                    }
                  />
                </div>

                {/* 封面圖片 */}
                <div className="space-y-2">
                  <Label>封面圖片</Label>
                  <p className="text-sm text-muted-foreground">
                    顯示在首頁計畫卡片上的圖片
                  </p>
                  <MultiImageUploader
                    type="plan-cover"
                    value={planFormData.coverImage ? [planFormData.coverImage] : []}
                    onChange={(images) =>
                      setPlanFormData(prev => ({ ...prev, coverImage: images[0] || null }))
                    }
                  />
                </div>

                {/* 卡片簡介 */}
                <div className="space-y-2">
                  <Label>卡片簡介</Label>
                  <p className="text-sm text-muted-foreground">
                    顯示在首頁計畫卡片下方的簡短說明
                  </p>
                  <textarea
                    className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={planFormData.cardDescription}
                    onChange={(e) =>
                      setPlanFormData({ ...planFormData, cardDescription: e.target.value })
                    }
                    placeholder="輸入卡片上顯示的簡介..."
                    maxLength={100}
                  />
                </div>

                {/* 介紹 PDF */}
                <div className="space-y-2">
                  <Label>介紹 PDF</Label>
                  <p className="text-sm text-muted-foreground">
                    訪客點擊計畫時會直接展示此 PDF
                  </p>
                  <StaticPDFInput
                    value={planFormData.introPdf}
                    onChange={(pdf) => setPlanFormData(prev => ({ ...prev, introPdf: pdf }))}
                    label="輸入 PDF 路徑，例如 /pdfs/intro.pdf"
                    placeholder="/pdfs/plan-intro.pdf"
                  />
                </div>

                {/* 下載 PDF */}
                <div className="space-y-2">
                  <Label>下載檔案</Label>
                  <p className="text-sm text-muted-foreground">
                    顯示在介紹頁下方供訪客下載
                  </p>
                  <StaticMultiPDFInput
                    value={planFormData.downloadPdfs}
                    onChange={(pdfs) => setPlanFormData(prev => ({ ...prev, downloadPdfs: pdfs }))}
                    maxCount={10}
                    label="新增下載檔案"
                  />
                </div>
              </div>
            )}

            {/* 流程編輯模式 */}
            {planFormMode === 'workflow' && (
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
            )}
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
      <Dialog open={isProjectFormOpen} onOpenChange={(open) => {
        setIsProjectFormOpen(open)
        if (open && savedScrollPositionRef.current > 0) {
          // Restore scroll position after dialog animation completes
          setTimeout(() => {
            if (projectDetailScrollRef.current) {
              projectDetailScrollRef.current.scrollTop = savedScrollPositionRef.current
            }
          }, 100)
        }
      }}>
        <DialogContent className="max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingProject ? "編輯個案" : "新增個案"}</DialogTitle>
            <DialogDescription>
              {selectedPlan?.name ? `${selectedPlan.name} 下的個案` : projectFormData.planId ? `${plans.find(p => p.id === projectFormData.planId)?.name} 下的個案` : "請先選擇計畫"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Plan selection - only show when no selectedPlan (flow mode) */}
            {!selectedPlan && !editingProject && (
              <div className="space-y-2">
                <Label>選擇計畫 *</Label>
                <Select
                  value={projectFormData.planId}
                  onValueChange={(v) =>
                    setProjectFormData({ ...projectFormData, planId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇計畫" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.status === 'active').map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>個案名稱 *</Label>
                <Input
                  value={projectFormData.name}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, name: e.target.value })
                  }
                  placeholder="例如：王小明"
                />
              </div>
              <div className="space-y-2">
                <Label>個案編號</Label>
                <Input
                  value={projectFormData.projectNumber}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, projectNumber: e.target.value })
                  }
                  placeholder={(() => {
                    const plan = selectedPlan || plans.find(p => p.id === projectFormData.planId)
                    return plan?.code ? `例如：${plan.code}11509001` : "例如：JL11509001"
                  })()}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>來源 *</Label>
                <Select
                  value={projectFormData.sourceType}
                  onValueChange={(v: "個人" | "機構" | "董事") =>
                    setProjectFormData({
                      ...projectFormData,
                      sourceType: v,
                      // Clear organization when not "機構"
                      organizationId: v === "機構" ? projectFormData.organizationId : "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇來源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="個人">個人</SelectItem>
                    <SelectItem value="機構">機構</SelectItem>
                    <SelectItem value="董事">董事</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>補助用途</Label>
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
                    <SelectItem value="急難救助">急難救助</SelectItem>
                    <SelectItem value="醫療補助">醫療補助</SelectItem>
                    <SelectItem value="教育扶助">教育扶助</SelectItem>
                    <SelectItem value="喪葬補助">喪葬補助</SelectItem>
                    <SelectItem value="生活扶助">生活扶助</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {projectFormData.sourceType === "機構" && (
              <div className="space-y-2">
                <Label>關聯機構 *</Label>
                <Select
                  value={projectFormData.organizationId}
                  onValueChange={(v) =>
                    setProjectFormData({ ...projectFormData, organizationId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇機構" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* First step attachment upload (only show when creating and first step requires attachment) */}
            {!editingProject && firstStepRequiresAttachment() && (
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <Label className="flex items-center gap-2 text-base">
                  <Paperclip className="h-4 w-4" />
                  {getFirstStepName()} - 附件上傳 *
                  <Badge variant="warning" className="text-xs">
                    {getTargetPlanForForm()?.workflow[0]?.type === "establishment" ? "成立審核" : "審批"}
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
            <DialogDescription>查看計畫介紹與流程</DialogDescription>
          </DialogHeader>

          {viewingPlan && (
            <div className="space-y-6">
              {/* Plan Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{viewingPlan.type}</Badge>
                  <Badge variant="outline">
                    {projects.filter(p => p.planId === viewingPlan.id && p.status !== "archived").length} 個案
                  </Badge>
                  {viewingPlan.isPublic && (
                    <Badge className="bg-green-100 text-green-800">已公開</Badge>
                  )}
                </div>
                {viewingPlan.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingPlan.description}</p>
                )}
              </div>

              <Separator />

              {/* 前台介紹預覽 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    前台介紹
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsPlanViewOpen(false)
                      openPlanForm(viewingPlan, 'intro')
                    }}
                  >
                    <EditIcon className="h-3 w-3 mr-1" />
                    編輯介紹
                  </Button>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  {viewingPlan.isPublic ? (
                    <>
                      {viewingPlan.coverImage && (
                        <div className="aspect-video max-w-xs rounded-lg overflow-hidden bg-muted">
                          <img
                            src={viewingPlan.coverImage.thumbnailUrl || viewingPlan.coverImage.originalUrl}
                            alt={viewingPlan.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {viewingPlan.publicDescription ? (
                        <p className="text-sm whitespace-pre-wrap">{viewingPlan.publicDescription}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">尚未設定前台介紹文字</p>
                      )}
                      {viewingPlan.introPdf && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span>介紹 PDF：{viewingPlan.introPdf.fileName}</span>
                        </div>
                      )}
                      {viewingPlan.downloadPdfs && viewingPlan.downloadPdfs.length > 0 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">下載檔案：</span>
                          {viewingPlan.downloadPdfs.map(pdf => pdf.fileName).join('、')}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      此計畫尚未公開到首頁
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* 流程預覽 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    流程步驟
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsPlanViewOpen(false)
                      openPlanForm(viewingPlan, 'workflow')
                    }}
                  >
                    <EditIcon className="h-3 w-3 mr-1" />
                    編輯流程
                  </Button>
                </div>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="p-3 md:p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 truncate pr-8">
              {previewFile?.type === "application/pdf" ? (
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <Eye className="h-5 w-5 shrink-0" />
              )}
              <span className="truncate text-sm md:text-base">{previewFile?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30" style={{ height: 'calc(95vh - 8rem)' }}>
            {previewFile?.type === "application/pdf" ? (
              <object
                data={previewFile.url}
                type="application/pdf"
                className="w-full h-full"
              >
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.url)}&embedded=true`}
                  className="w-full h-full"
                  title={previewFile.name}
                >
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <FileText className="h-16 w-16 text-red-500 mb-4" />
                    <p className="text-muted-foreground mb-4">無法在瀏覽器中預覽此 PDF</p>
                    <Button asChild>
                      <a href={previewFile.url} target="_blank" rel="noopener noreferrer">
                        在新分頁開啟
                      </a>
                    </Button>
                  </div>
                </iframe>
              </object>
            ) : (
              <div className="flex items-center justify-center p-4 h-full">
                <img
                  src={previewFile?.url}
                  alt={previewFile?.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
          </div>
          <div className="p-3 border-t flex justify-between items-center shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {previewFile?.type === "application/pdf" && "PDF 預覽 - 如果無法顯示，請點擊新分頁開啟"}
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewFile(null)}
              >
                關閉
              </Button>
              <Button
                variant="default"
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
