import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { organizationService, userService, projectService } from "@/services"
import { useAuth } from "@/contexts/AuthContext"
import type {
  OrganizationWithDetails,
  VisitRecordWithDetails,
  UpcomingVisitWithDetails,
  SubsidyRecord,
  NextStepItem,
  ProgressUpdateItem,
  OrganizationCategory,
  OrganizationCategoryItem,
  CooperationStatus,
  User,
  Project,
  Plan,
} from "@/types"
import { OrganizationCategoryLabels, CooperationStatusLabels, CooperationStatusColors } from "@/types"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Phone,
  Globe,
  MessageSquare,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  FolderKanban,
  DollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ProjectDetailView } from "@/components/ProjectDetailView"

export function OrganizationsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [organizations, setOrganizations] = useState<OrganizationWithDetails[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<OrganizationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [cooperationFilter, setCooperationFilter] = useState<string>("all")

  // Plans for linking (many-to-many)
  const [plans, setPlans] = useState<Plan[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<OrganizationCategoryItem[]>([])

  // Split panel state
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithDetails | null>(null)
  const [visitRecords, setVisitRecords] = useState<VisitRecordWithDetails[]>([])
  const [upcomingVisits, setUpcomingVisits] = useState<UpcomingVisitWithDetails[]>([])
  const [subsidyRecords, setSubsidyRecords] = useState<SubsidyRecord[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)

  // Mobile view state (for responsive single-column switching)
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")

  // Create/Edit organization dialog
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<OrganizationWithDetails | null>(null)
  const [orgForm, setOrgForm] = useState({
    name: "",
    category: "other" as OrganizationCategory,
    categoryName: "其他",
    cooperationStatus: "evaluating" as CooperationStatus,
    contactPerson: "",
    address: "",
    addressUrl: "",
    phone: "",
    website: "",
    lineId: "",
    notes: "",
    planIds: [] as string[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Create visit record dialog
  const [isVisitDialogOpen, setIsVisitDialogOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState<VisitRecordWithDetails | null>(null)
  const [visitForm, setVisitForm] = useState({
    visitDate: format(new Date(), "yyyy-MM-dd"),
    visitorIds: [] as string[],
    customVisitors: [] as string[],
    purpose: "",
    content: "",
    orgRequests: "",
    foundationRequests: "",
    nextStepsFoundation: [] as NextStepItem[],
    nextStepsOrg: [] as NextStepItem[],
    progressUpdates: [] as ProgressUpdateItem[],
  })
  // 暫存新增的下一步項目
  const [newNextStepFoundation, setNewNextStepFoundation] = useState("")
  const [newNextStepOrg, setNewNextStepOrg] = useState("")
  // 暫存新增的進度更新
  const [newProgressDate, setNewProgressDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [newProgressContent, setNewProgressContent] = useState("")
  // 暫存手動輸入的訪視人員
  const [newCustomVisitor, setNewCustomVisitor] = useState("")
  // 內聯進度更新
  const [inlineProgressRecordId, setInlineProgressRecordId] = useState<string | null>(null)
  const [inlineProgressDate, setInlineProgressDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [inlineProgressContent, setInlineProgressContent] = useState("")
  // 內聯下一步新增
  const [inlineNextStepRecordId, setInlineNextStepRecordId] = useState<string | null>(null)
  const [inlineNextStepType, setInlineNextStepType] = useState<'foundation' | 'org'>('foundation')
  const [inlineNextStepContent, setInlineNextStepContent] = useState("")

  // Inline status change
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)

  // Quick upcoming visit dialog (from left panel, needs org selection)
  const [isQuickUpcomingDialogOpen, setIsQuickUpcomingDialogOpen] = useState(false)
  const [quickUpcomingOrgId, setQuickUpcomingOrgId] = useState<string>("")
  const [quickUpcomingOrgMode, setQuickUpcomingOrgMode] = useState<"select" | "new">("select")
  const [quickUpcomingNewOrgName, setQuickUpcomingNewOrgName] = useState("")
  const [quickUpcomingForm, setQuickUpcomingForm] = useState({
    plannedDate: format(new Date(), "yyyy-MM-dd"),
    plannedTime: "",
    purpose: "",
    assignedUserIds: [] as string[],
    notes: "",
  })

  // Create upcoming visit dialog
  const [isUpcomingDialogOpen, setIsUpcomingDialogOpen] = useState(false)
  const [upcomingForm, setUpcomingForm] = useState({
    plannedDate: format(new Date(), "yyyy-MM-dd"),
    plannedTime: "",
    purpose: "",
    assignedUserIds: [] as string[],
    notes: "",
  })

  // Subsidy record dialog
  const [isSubsidyDialogOpen, setIsSubsidyDialogOpen] = useState(false)
  const [editingSubsidy, setEditingSubsidy] = useState<SubsidyRecord | null>(null)

  // Project detail modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)

  // 右側分頁狀態（控制式）
  const [activeTab, setActiveTab] = useState<string>("records")

  const [subsidyForm, setSubsidyForm] = useState({
    subsidyDate: format(new Date(), "yyyy-MM-dd"),
    subsidyItems: "",
    subsidyAmount: "" as string | number,
    deliveryMethod: "",
    deliveryStatus: "",
    notes: "",
  })

  // 補助清單 dialog
  const [isSubsidyListDialogOpen, setIsSubsidyListDialogOpen] = useState(false)
  const [allSubsidyRecords, setAllSubsidyRecords] = useState<(SubsidyRecord & { organization?: { id: string; name: string } })[]>([])
  const [isLoadingSubsidyList, setIsLoadingSubsidyList] = useState(false)

  // Pending upcoming visits for dashboard
  const [pendingVisits, setPendingVisits] = useState<UpcomingVisitWithDetails[]>([])

  // Ref for visit records scroll area to preserve scroll position
  const visitRecordsScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTopRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef<boolean>(false)

  // 使用 useLayoutEffect 在 DOM 更新後立即恢復滾動位置
  useLayoutEffect(() => {
    if (shouldRestoreScrollRef.current) {
      const restoreScroll = () => {
        const el = document.querySelector('.flex-1.overflow-y-auto.pr-2') as HTMLDivElement
        if (el) {
          el.scrollTop = savedScrollTopRef.current
        }
      }
      // 立即執行一次
      restoreScroll()
      // 再用 requestAnimationFrame 確保在繪製後執行
      requestAnimationFrame(restoreScroll)
      shouldRestoreScrollRef.current = false
    }
  })

  // Compute related projects for selected organization
  const relatedProjects = useMemo(() => {
    if (!selectedOrg) return []
    return projects.filter(p => p.organizationId === selectedOrg.id)
  }, [selectedOrg, projects])

  useEffect(() => {
    loadData()
  }, [])

  // Handle URL parameter to select organization
  useEffect(() => {
    const orgId = searchParams.get("org")
    if (orgId && organizations.length > 0 && !isLoading) {
      const org = organizations.find(o => o.id === orgId)
      if (org) {
        handleSelectOrg(org)
        // Clear the URL parameter after selection
        setSearchParams({})
      }
    }
  }, [organizations, isLoading, searchParams])

  // Close status menu when clicking outside
  useEffect(() => {
    if (!isStatusMenuOpen) return
    const handleClickOutside = () => setIsStatusMenuOpen(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isStatusMenuOpen])

  const loadData = async () => {
    try {
      const [orgsData, plansData, projectsData, usersData, pendingData, categoriesData] = await Promise.all([
        organizationService.getOrganizations(),
        projectService.getPlans(),
        projectService.getProjects(),
        userService.getAllStaff(),
        organizationService.getPendingUpcomingVisits(),
        organizationService.getOrganizationCategories(),
      ])
      setOrganizations(orgsData)
      setFilteredOrganizations(orgsData)
      setPlans(plansData)
      setProjects(projectsData)
      setAllUsers(usersData)
      setPendingVisits(pendingData)
      setCategories(categoriesData)

      // If an org was selected, refresh its data
      if (selectedOrg) {
        const updatedOrg = orgsData.find(o => o.id === selectedOrg.id)
        if (updatedOrg) {
          setSelectedOrg(updatedOrg)
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Count of not_cooperating organizations
  const notCooperatingCount = organizations.filter(o => o.cooperationStatus === 'not_cooperating').length

  useEffect(() => {
    let result = organizations

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(query) ||
          o.contactPerson?.toLowerCase().includes(query) ||
          o.address?.toLowerCase().includes(query)
      )
    }

    if (categoryFilter !== "all") {
      result = result.filter((o) => (o.categoryName || OrganizationCategoryLabels[o.category]) === categoryFilter)
    }

    if (cooperationFilter === "not_cooperating") {
      // Show only not_cooperating
      result = result.filter((o) => o.cooperationStatus === "not_cooperating")
    } else if (cooperationFilter !== "all") {
      // Filter by specific status (excluding not_cooperating from other filters)
      result = result.filter((o) => o.cooperationStatus === cooperationFilter)
    } else {
      // Default: exclude not_cooperating from main list
      result = result.filter((o) => o.cooperationStatus !== "not_cooperating")
    }

    // Sort by cooperation status priority: cooperating > referral_only > evaluating > not_cooperating
    const statusPriority: Record<string, number> = {
      cooperating: 0,
      referral_only: 1,
      evaluating: 2,
      not_cooperating: 3,
    }
    result = [...result].sort((a, b) => {
      const priorityA = statusPriority[a.cooperationStatus || 'not_cooperating'] ?? 4
      const priorityB = statusPriority[b.cooperationStatus || 'not_cooperating'] ?? 4
      return priorityA - priorityB
    })

    setFilteredOrganizations(result)
  }, [organizations, searchQuery, categoryFilter, cooperationFilter])

  const handleSelectOrg = async (org: OrganizationWithDetails) => {
    setSelectedOrg(org)
    setMobileView("detail")
    setIsLoadingRecords(true)
    setIsStatusMenuOpen(false)
    setActiveTab("records")  // 選擇新機構時重置為訪視分頁

    try {
      const [records, upcoming, subsidies] = await Promise.all([
        organizationService.getVisitRecords(org.id),
        organizationService.getUpcomingVisits(org.id),
        organizationService.getSubsidyRecords(org.id),
      ])
      setVisitRecords(records)
      setUpcomingVisits(upcoming)
      setSubsidyRecords(subsidies)
    } catch (error) {
      console.error("Failed to load records:", error)
    } finally {
      setIsLoadingRecords(false)
    }
  }

  const handleBackToList = () => {
    setMobileView("list")
  }

  // 打開補助清單
  const handleOpenSubsidyList = async () => {
    setIsSubsidyListDialogOpen(true)
    setIsLoadingSubsidyList(true)
    try {
      const records = await organizationService.getAllSubsidyRecords()
      setAllSubsidyRecords(records)
    } catch (error) {
      console.error("Failed to load subsidy records:", error)
    } finally {
      setIsLoadingSubsidyList(false)
    }
  }

  const handleCreateOrg = () => {
    setEditingOrg(null)
    setOrgForm({
      name: "",
      category: "other",
      categoryName: "其他",
      cooperationStatus: "evaluating",
      contactPerson: "",
      address: "",
      addressUrl: "",
      phone: "",
      website: "",
      lineId: "",
      notes: "",
      planIds: [],
    })
    setIsOrgDialogOpen(true)
  }

  const handleEditOrg = (org: OrganizationWithDetails) => {
    setEditingOrg(org)
    setOrgForm({
      name: org.name,
      category: org.category,
      categoryName: org.categoryName || OrganizationCategoryLabels[org.category] || "其他",
      cooperationStatus: org.cooperationStatus || "evaluating",
      contactPerson: org.contactPerson || "",
      address: org.address || "",
      addressUrl: org.addressUrl || "",
      phone: org.phone || "",
      website: org.website || "",
      lineId: org.lineId || "",
      notes: org.notes || "",
      planIds: org.planIds || [],
    })
    setIsOrgDialogOpen(true)
  }

  // Toggle plan selection
  const togglePlanSelection = (planId: string) => {
    setOrgForm(prev => ({
      ...prev,
      planIds: prev.planIds.includes(planId)
        ? prev.planIds.filter(id => id !== planId)
        : [...prev.planIds, planId]
    }))
  }

  const handleSubmitOrg = async () => {
    if (!orgForm.name.trim()) {
      alert("請輸入機構名稱")
      return
    }

    setIsSubmitting(true)
    try {
      if (editingOrg) {
        await organizationService.updateOrganization(editingOrg.id, orgForm)
      } else {
        await organizationService.createOrganization({
          ...orgForm,
          createdBy: user!.id,
        })
      }
      await loadData()
      setIsOrgDialogOpen(false)
    } catch (error) {
      console.error("Failed to save organization:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteOrg = async (org: OrganizationWithDetails) => {
    if (!confirm(`確定要刪除「${org.name}」嗎？此操作無法復原。`)) return

    try {
      await organizationService.deleteOrganization(org.id)
      await loadData()
      if (selectedOrg?.id === org.id) {
        setSelectedOrg(null)
        setMobileView("list")
      }
    } catch (error) {
      console.error("Failed to delete organization:", error)
      alert("刪除失敗，請稍後再試")
    }
  }

  // 直接更新機構合作狀態
  const handleUpdateCooperationStatus = async (newStatus: CooperationStatus) => {
    if (!selectedOrg) return

    try {
      await organizationService.updateOrganization(selectedOrg.id, {
        cooperationStatus: newStatus
      })
      // 更新本地狀態
      const updatedOrg = { ...selectedOrg, cooperationStatus: newStatus }
      setSelectedOrg(updatedOrg)
      setOrganizations(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o))
      setIsStatusMenuOpen(false)
    } catch (error) {
      console.error("Failed to update cooperation status:", error)
      alert("更新狀態失敗，請稍後再試")
    }
  }

  const handleCreateVisitRecord = () => {
    setEditingVisit(null)
    setVisitForm({
      visitDate: format(new Date(), "yyyy-MM-dd"),
      visitorIds: [],
      customVisitors: [],
      purpose: "",
      content: "",
      orgRequests: "",
      foundationRequests: "",
      nextStepsFoundation: [],
      nextStepsOrg: [],
      progressUpdates: [],
    })
    setNewNextStepFoundation("")
    setNewNextStepOrg("")
    setNewCustomVisitor("")
    setNewProgressDate(format(new Date(), "yyyy-MM-dd"))
    setNewProgressContent("")
    setIsVisitDialogOpen(true)
  }

  const handleEditVisitRecord = (record: VisitRecordWithDetails) => {
    setEditingVisit(record)
    setVisitForm({
      visitDate: record.visitDate,
      visitorIds: record.visitorIds,
      customVisitors: record.customVisitors || [],
      purpose: record.purpose || "",
      content: record.content || "",
      orgRequests: record.orgRequests || "",
      foundationRequests: record.foundationRequests || "",
      nextStepsFoundation: record.nextStepsFoundation || [],
      nextStepsOrg: record.nextStepsOrg || [],
      progressUpdates: record.progressUpdates || [],
    })
    setNewNextStepFoundation("")
    setNewNextStepOrg("")
    setNewCustomVisitor("")
    setNewProgressDate(format(new Date(), "yyyy-MM-dd"))
    setNewProgressContent("")
    setIsVisitDialogOpen(true)
  }

  // Quick upcoming visit from left panel (needs to select organization)
  const handleQuickCreateUpcoming = () => {
    setQuickUpcomingOrgId("")
    setQuickUpcomingOrgMode("select")
    setQuickUpcomingNewOrgName("")
    setQuickUpcomingForm({
      plannedDate: format(new Date(), "yyyy-MM-dd"),
      plannedTime: "",
      purpose: "",
      assignedUserIds: [],
      notes: "",
    })
    setIsQuickUpcomingDialogOpen(true)
  }

  const handleSubmitVisitRecord = async () => {
    if (!selectedOrg) return
    if (visitForm.visitorIds.length === 0 && visitForm.customVisitors.length === 0) {
      alert("請選擇或輸入訪視人員")
      return
    }

    setIsSubmitting(true)
    try {
      if (editingVisit) {
        await organizationService.updateVisitRecord(editingVisit.id, visitForm)
      } else {
        await organizationService.createVisitRecord({
          organizationId: selectedOrg.id,
          ...visitForm,
          createdBy: user!.id,
        })
      }

      // Reload records
      const records = await organizationService.getVisitRecords(selectedOrg.id)
      setVisitRecords(records)

      setIsVisitDialogOpen(false)
      await loadData() // Refresh stats
    } catch (error) {
      console.error("Failed to save visit record:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 下一步項目操作
  const addNextStepFoundation = () => {
    if (!newNextStepFoundation.trim()) return
    setVisitForm(prev => ({
      ...prev,
      nextStepsFoundation: [
        ...prev.nextStepsFoundation,
        { id: crypto.randomUUID(), content: newNextStepFoundation.trim(), completed: false }
      ]
    }))
    setNewNextStepFoundation("")
  }

  const addNextStepOrg = () => {
    if (!newNextStepOrg.trim()) return
    setVisitForm(prev => ({
      ...prev,
      nextStepsOrg: [
        ...prev.nextStepsOrg,
        { id: crypto.randomUUID(), content: newNextStepOrg.trim(), completed: false }
      ]
    }))
    setNewNextStepOrg("")
  }

  const toggleNextStepFoundation = (id: string) => {
    setVisitForm(prev => ({
      ...prev,
      nextStepsFoundation: prev.nextStepsFoundation.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    }))
  }

  const toggleNextStepOrg = (id: string) => {
    setVisitForm(prev => ({
      ...prev,
      nextStepsOrg: prev.nextStepsOrg.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    }))
  }

  const removeNextStepFoundation = (id: string) => {
    setVisitForm(prev => ({
      ...prev,
      nextStepsFoundation: prev.nextStepsFoundation.filter(item => item.id !== id)
    }))
  }

  const removeNextStepOrg = (id: string) => {
    setVisitForm(prev => ({
      ...prev,
      nextStepsOrg: prev.nextStepsOrg.filter(item => item.id !== id)
    }))
  }

  // 進度更新操作
  const addProgressUpdate = () => {
    if (!newProgressContent.trim()) return
    setVisitForm(prev => ({
      ...prev,
      progressUpdates: [
        ...prev.progressUpdates,
        { id: crypto.randomUUID(), date: newProgressDate, content: newProgressContent.trim() }
      ]
    }))
    setNewProgressContent("")
    setNewProgressDate(format(new Date(), "yyyy-MM-dd"))
  }

  const removeProgressUpdate = (id: string) => {
    setVisitForm(prev => ({
      ...prev,
      progressUpdates: prev.progressUpdates.filter(item => item.id !== id)
    }))
  }

  // 手動輸入訪視人員操作
  const addCustomVisitor = () => {
    if (!newCustomVisitor.trim()) return
    setVisitForm(prev => ({
      ...prev,
      customVisitors: [...prev.customVisitors, newCustomVisitor.trim()]
    }))
    setNewCustomVisitor("")
  }

  const removeCustomVisitor = (name: string) => {
    setVisitForm(prev => ({
      ...prev,
      customVisitors: prev.customVisitors.filter(v => v !== name)
    }))
  }

  // 保存並還原滾動位置的輔助函數
  const preserveScrollPosition = (callback: () => void) => {
    // 從 DOM 直接獲取當前滾動位置
    const el = document.querySelector('.flex-1.overflow-y-auto.pr-2') as HTMLDivElement
    savedScrollTopRef.current = el?.scrollTop ?? 0
    shouldRestoreScrollRef.current = true
    callback()
  }

  // 內聯更新下一步狀態（直接在卡片視圖中切換）
  const handleInlineToggleNextStep = async (
    recordId: string,
    stepType: 'foundation' | 'org',
    stepId: string
  ) => {
    const record = visitRecords.find(r => r.id === recordId)
    if (!record) return

    const steps = stepType === 'foundation' ? record.nextStepsFoundation : record.nextStepsOrg
    if (!steps) return

    const updatedSteps = steps.map(item =>
      item.id === stepId ? { ...item, completed: !item.completed } : item
    )

    // 直接更新本地狀態，保留滾動位置
    preserveScrollPosition(() => {
      setVisitRecords(prev => prev.map(r => {
        if (r.id !== recordId) return r
        if (stepType === 'foundation') {
          return { ...r, nextStepsFoundation: updatedSteps }
        } else {
          return { ...r, nextStepsOrg: updatedSteps }
        }
      }))
    })

    try {
      if (stepType === 'foundation') {
        await organizationService.updateVisitRecord(recordId, { nextStepsFoundation: updatedSteps })
      } else {
        await organizationService.updateVisitRecord(recordId, { nextStepsOrg: updatedSteps })
      }
    } catch (error) {
      console.error("Failed to update next step:", error)
    }
  }

  // 內聯新增下一步項目
  const handleInlineAddNextStep = async (recordId: string, stepType: 'foundation' | 'org') => {
    if (!inlineNextStepContent.trim()) return

    const record = visitRecords.find(r => r.id === recordId)
    if (!record) return

    const newItem: NextStepItem = {
      id: crypto.randomUUID(),
      content: inlineNextStepContent.trim(),
      completed: false
    }

    const updatedSteps = stepType === 'foundation'
      ? [...(record.nextStepsFoundation || []), newItem]
      : [...(record.nextStepsOrg || []), newItem]

    // 直接更新本地狀態，保留滾動位置
    preserveScrollPosition(() => {
      setVisitRecords(prev => prev.map(r => {
        if (r.id !== recordId) return r
        if (stepType === 'foundation') {
          return { ...r, nextStepsFoundation: updatedSteps }
        } else {
          return { ...r, nextStepsOrg: updatedSteps }
        }
      }))
      setInlineNextStepRecordId(null)
      setInlineNextStepContent("")
    })

    try {
      if (stepType === 'foundation') {
        await organizationService.updateVisitRecord(recordId, { nextStepsFoundation: updatedSteps })
      } else {
        await organizationService.updateVisitRecord(recordId, { nextStepsOrg: updatedSteps })
      }
    } catch (error) {
      console.error("Failed to add next step:", error)
    }
  }

  // 內聯新增進度更新
  const handleInlineAddProgress = async (recordId: string) => {
    if (!inlineProgressContent.trim()) return

    const record = visitRecords.find(r => r.id === recordId)
    if (!record) return

    const updatedProgress = [
      ...(record.progressUpdates || []),
      { id: crypto.randomUUID(), date: inlineProgressDate, content: inlineProgressContent.trim() }
    ]

    // 直接更新本地狀態，保留滾動位置
    preserveScrollPosition(() => {
      setVisitRecords(prev => prev.map(r => {
        if (r.id !== recordId) return r
        return { ...r, progressUpdates: updatedProgress }
      }))
      setInlineProgressRecordId(null)
      setInlineProgressContent("")
      setInlineProgressDate(format(new Date(), "yyyy-MM-dd"))
    })

    try {
      await organizationService.updateVisitRecord(recordId, { progressUpdates: updatedProgress })
    } catch (error) {
      console.error("Failed to add progress update:", error)
    }
  }

  // Submit quick upcoming visit (from left panel with org selection)
  const handleSubmitQuickUpcomingVisit = async () => {
    let targetOrgId = quickUpcomingOrgId

    // If creating new org
    if (quickUpcomingOrgMode === "new") {
      if (!quickUpcomingNewOrgName.trim()) {
        alert("請輸入機構名稱")
        return
      }
    } else {
      if (!quickUpcomingOrgId) {
        alert("請選擇機構")
        return
      }
    }

    if (quickUpcomingForm.assignedUserIds.length === 0) {
      alert("請選擇負責人員")
      return
    }

    setIsSubmitting(true)
    try {
      // Create new org if needed
      if (quickUpcomingOrgMode === "new") {
        const newOrg = await organizationService.createOrganization({
          name: quickUpcomingNewOrgName.trim(),
          category: "other",
          planIds: [],
          createdBy: user!.id,
        })
        targetOrgId = newOrg.id
      }

      await organizationService.createUpcomingVisit({
        organizationId: targetOrgId,
        ...quickUpcomingForm,
        plannedTime: quickUpcomingForm.plannedTime || undefined,
        status: "pending",
        createdBy: user!.id,
      })

      // Reload upcoming visits if we have a selected org that matches
      if (selectedOrg && selectedOrg.id === targetOrgId) {
        const upcoming = await organizationService.getUpcomingVisits(selectedOrg.id)
        setUpcomingVisits(upcoming)
      }

      setIsQuickUpcomingDialogOpen(false)
      await loadData() // Refresh stats and pending visits
    } catch (error) {
      console.error("Failed to create upcoming visit:", error)
      alert("新增失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateUpcomingVisit = () => {
    setUpcomingForm({
      plannedDate: format(new Date(), "yyyy-MM-dd"),
      plannedTime: "",
      purpose: "",
      assignedUserIds: [],
      notes: "",
    })
    setIsUpcomingDialogOpen(true)
  }

  const handleSubmitUpcomingVisit = async () => {
    if (!selectedOrg) return
    if (upcomingForm.assignedUserIds.length === 0) {
      alert("請選擇負責人員")
      return
    }

    setIsSubmitting(true)
    try {
      await organizationService.createUpcomingVisit({
        organizationId: selectedOrg.id,
        ...upcomingForm,
        plannedTime: upcomingForm.plannedTime || undefined,
        status: "pending",
        createdBy: user!.id,
      })

      // Reload upcoming visits
      const upcoming = await organizationService.getUpcomingVisits(selectedOrg.id)
      setUpcomingVisits(upcoming)
      setIsUpcomingDialogOpen(false)
      await loadData() // Refresh stats
    } catch (error) {
      console.error("Failed to create upcoming visit:", error)
      alert("新增失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteVisit = async (visitId: string) => {
    try {
      await organizationService.completeUpcomingVisit(visitId)
      if (selectedOrg) {
        const upcoming = await organizationService.getUpcomingVisits(selectedOrg.id)
        setUpcomingVisits(upcoming)
      }
      await loadData()
    } catch (error) {
      console.error("Failed to complete visit:", error)
    }
  }

  const handleCancelVisit = async (visitId: string) => {
    try {
      await organizationService.cancelUpcomingVisit(visitId)
      if (selectedOrg) {
        const upcoming = await organizationService.getUpcomingVisits(selectedOrg.id)
        setUpcomingVisits(upcoming)
      }
      await loadData()
    } catch (error) {
      console.error("Failed to cancel visit:", error)
    }
  }

  // Subsidy record handlers
  const handleCreateSubsidy = () => {
    setEditingSubsidy(null)
    setSubsidyForm({
      subsidyDate: format(new Date(), "yyyy-MM-dd"),
      subsidyItems: "",
      subsidyAmount: "",
      deliveryMethod: "",
      deliveryStatus: "",
      notes: "",
    })
    setIsSubsidyDialogOpen(true)
  }

  const handleEditSubsidy = (record: SubsidyRecord) => {
    setEditingSubsidy(record)
    setSubsidyForm({
      subsidyDate: record.subsidyDate || "",
      subsidyItems: record.subsidyItems,
      subsidyAmount: record.subsidyAmount || "",
      deliveryMethod: record.deliveryMethod || "",
      deliveryStatus: record.deliveryStatus || "",
      notes: record.notes || "",
    })
    setIsSubsidyDialogOpen(true)
  }

  const handleSubmitSubsidy = async () => {
    if (!selectedOrg) return
    if (!subsidyForm.subsidyItems.trim()) {
      alert("請輸入補助項目")
      return
    }

    setIsSubmitting(true)
    try {
      const submitData = {
        organizationId: selectedOrg.id,
        subsidyDate: subsidyForm.subsidyDate || undefined,
        subsidyItems: subsidyForm.subsidyItems,
        subsidyAmount: subsidyForm.subsidyAmount ? Number(subsidyForm.subsidyAmount) : undefined,
        deliveryMethod: subsidyForm.deliveryMethod || undefined,
        deliveryStatus: subsidyForm.deliveryStatus || undefined,
        notes: subsidyForm.notes || undefined,
        createdBy: user!.id,
      }

      if (editingSubsidy) {
        await organizationService.updateSubsidyRecord(editingSubsidy.id, submitData)
      } else {
        await organizationService.createSubsidyRecord(submitData)
      }

      // Reload subsidy records
      const subsidies = await organizationService.getSubsidyRecords(selectedOrg.id)
      setSubsidyRecords(subsidies)
      setIsSubsidyDialogOpen(false)
    } catch (error) {
      console.error("Failed to save subsidy record:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSubsidy = async (record: SubsidyRecord) => {
    if (!confirm("確定要刪除此補助紀錄嗎？")) return

    try {
      await organizationService.deleteSubsidyRecord(record.id)
      if (selectedOrg) {
        const subsidies = await organizationService.getSubsidyRecords(selectedOrg.id)
        setSubsidyRecords(subsidies)
      }
    } catch (error) {
      console.error("Failed to delete subsidy record:", error)
      alert("刪除失敗，請稍後再試")
    }
  }

  const toggleVisitor = (userId: string) => {
    setVisitForm(prev => ({
      ...prev,
      visitorIds: prev.visitorIds.includes(userId)
        ? prev.visitorIds.filter(id => id !== userId)
        : [...prev.visitorIds, userId]
    }))
  }

  const toggleAssignedUser = (userId: string) => {
    setUpcomingForm(prev => ({
      ...prev,
      assignedUserIds: prev.assignedUserIds.includes(userId)
        ? prev.assignedUserIds.filter(id => id !== userId)
        : [...prev.assignedUserIds, userId]
    }))
  }

  const toggleQuickUpcomingUser = (userId: string) => {
    setQuickUpcomingForm(prev => ({
      ...prev,
      assignedUserIds: prev.assignedUserIds.includes(userId)
        ? prev.assignedUserIds.filter(id => id !== userId)
        : [...prev.assignedUserIds, userId]
    }))
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">機構管理</h1>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">載入中...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Organization List Panel Component
  const OrganizationListPanel = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">機構列表</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={handleOpenSubsidyList}>
              <DollarSign className="h-4 w-4 mr-1" />
              補助清單
            </Button>
            <Button size="sm" variant="outline" onClick={handleQuickCreateUpcoming}>
              <Calendar className="h-4 w-4 mr-1" />
              新增訪視
            </Button>
            <Button size="sm" onClick={handleCreateOrg}>
              <Plus className="h-4 w-4 mr-1" />
              新增
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋機構..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSelectedOrg(null) }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="機構類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部類型</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cooperationFilter} onValueChange={(v) => { setCooperationFilter(v); setSelectedOrg(null) }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="合作狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="cooperating">合作</SelectItem>
                <SelectItem value="not_cooperating">不合作</SelectItem>
                <SelectItem value="referral_only">僅轉介個案</SelectItem>
                <SelectItem value="evaluating">討論評估中</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {filteredOrganizations.length} 間</span>
          <div className="flex gap-2">
            {pendingVisits.length > 0 && (
              <Badge variant="warning" className="text-xs">
                {pendingVisits.length} 待訪視
              </Badge>
            )}
            {notCooperatingCount > 0 && (
              <Badge
                variant={cooperationFilter === "not_cooperating" ? "destructive" : "outline"}
                className="text-xs cursor-pointer"
                onClick={() => {
                  setCooperationFilter(cooperationFilter === "not_cooperating" ? "all" : "not_cooperating")
                  setSelectedOrg(null)
                }}
              >
                不合作 ({notCooperatingCount})
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Organization List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredOrganizations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              沒有符合條件的機構
            </div>
          ) : (
            filteredOrganizations.map((org) => (
              <div
                key={org.id}
                className={cn(
                  "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedOrg?.id === org.id && "bg-muted"
                )}
                onClick={() => handleSelectOrg(org)}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Icon + Name + Category */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{org.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {org.categoryName || OrganizationCategoryLabels[org.category]}
                    </Badge>
                  </div>
                  {/* Right: Status badge (rightmost) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(org.upcomingVisitCount || 0) > 0 && (
                      <Badge variant="warning" className="text-xs">
                        {org.upcomingVisitCount} 待訪
                      </Badge>
                    )}
                    {org.cooperationStatus && org.cooperationStatus !== 'cooperating' && (
                      <Badge
                        variant={CooperationStatusColors[org.cooperationStatus]}
                        className="text-xs"
                      >
                        {CooperationStatusLabels[org.cooperationStatus]}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground md:hidden" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )

  // Organization Detail Panel Component
  const OrganizationDetailPanel = () => {
    if (!selectedOrg) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>選擇一個機構查看詳情</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header with basic info */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2 md:hidden">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回列表
            </Button>
          </div>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <h2 className="text-xl font-semibold truncate">{selectedOrg.name}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
                <Badge variant="secondary">
                  {selectedOrg.categoryName || OrganizationCategoryLabels[selectedOrg.category]}
                </Badge>
                {selectedOrg.cooperationStatus && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <Badge
                      variant={CooperationStatusColors[selectedOrg.cooperationStatus]}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                    >
                      {CooperationStatusLabels[selectedOrg.cooperationStatus]}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Badge>
                    {isStatusMenuOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-background border rounded-md shadow-lg z-50 py-1 min-w-[120px]">
                        {(Object.keys(CooperationStatusLabels) as CooperationStatus[]).map((status) => (
                          <button
                            key={status}
                            className={cn(
                              "w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors",
                              selectedOrg.cooperationStatus === status && "bg-muted font-medium"
                            )}
                            onClick={() => handleUpdateCooperationStatus(status)}
                          >
                            {CooperationStatusLabels[status]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {relatedProjects.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <FolderKanban className="h-3 w-3 mr-1" />
                    {relatedProjects.length} 個個案
                  </Badge>
                )}
                {selectedOrg.contactPerson && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {selectedOrg.contactPerson}
                  </span>
                )}
                {selectedOrg.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {selectedOrg.phone}
                  </span>
                )}
                {selectedOrg.address && (
                  selectedOrg.addressUrl ? (
                    <a
                      href={selectedOrg.addressUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{selectedOrg.address}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{selectedOrg.address}</span>
                    </span>
                  )
                )}
                {selectedOrg.website && (
                  <a
                    href={selectedOrg.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    網站
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {selectedOrg.lineId && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    {selectedOrg.lineId}
                  </span>
                )}
              </div>
              {selectedOrg.notes && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {selectedOrg.notes}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              <Button variant="ghost" size="sm" onClick={() => handleEditOrg(selectedOrg)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDeleteOrg(selectedOrg)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs Content - records, projects, subsidy */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="records">
                訪視 ({visitRecords.length})
                {upcomingVisits.filter(v => v.status === 'pending').length > 0 && (
                  <Badge variant="warning" className="ml-1 text-xs px-1">
                    {upcomingVisits.filter(v => v.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="projects">個案 ({relatedProjects.length})</TabsTrigger>
              <TabsTrigger value="subsidy">補助 ({subsidyRecords.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="projects" className="flex-1 overflow-hidden flex flex-col p-4 pt-0 mt-0">
            <ScrollArea className="flex-1 mt-2">
              {isLoadingRecords ? (
                <div className="text-center text-muted-foreground py-8">載入中...</div>
              ) : relatedProjects.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">尚無相關個案</div>
              ) : (
                <div className="space-y-3 pr-4">
                  {relatedProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedProject(project)
                        setIsProjectModalOpen(true)
                      }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{project.name}</span>
                              {project.projectNumber && (
                                <Badge variant="outline" className="text-xs">
                                  {project.projectNumber}
                                </Badge>
                              )}
                              <Badge variant={
                                project.status === 'active' ? 'success' :
                                project.status === 'completed' ? 'secondary' : 'warning'
                              }>
                                {project.status === 'active' ? '進行中' :
                                 project.status === 'completed' ? '已完成' : '規劃中'}
                              </Badge>
                            </div>
                            {project.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {project.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="subsidy" className="flex-1 overflow-hidden flex flex-col p-4 pt-0 mt-0">
            <div className="flex justify-end py-2">
              <Button size="sm" onClick={handleCreateSubsidy}>
                <Plus className="h-4 w-4 mr-1" />
                新增補助紀錄
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {isLoadingRecords ? (
                <div className="text-center text-muted-foreground py-8">載入中...</div>
              ) : subsidyRecords.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">尚無補助紀錄</div>
              ) : (
                <div className="space-y-3 pr-4">
                  {subsidyRecords.map((record) => (
                    <Card key={record.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <DollarSign className="h-4 w-4 text-green-600 shrink-0" />
                              <span className="font-medium">{record.subsidyItems}</span>
                              {record.subsidyAmount && (
                                <Badge variant="success" className="text-xs">
                                  NT${record.subsidyAmount.toLocaleString()}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                              {record.subsidyDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(record.subsidyDate), "yyyy/MM/dd", { locale: zhTW })}
                                </span>
                              )}
                              {record.deliveryMethod && (
                                <span>交付方式：{record.deliveryMethod}</span>
                              )}
                              {record.deliveryStatus && (
                                <Badge variant="outline" className="text-xs">
                                  {record.deliveryStatus}
                                </Badge>
                              )}
                            </div>
                            {record.notes && (
                              <p className="text-sm text-muted-foreground">{record.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSubsidy(record)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSubsidy(record)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="records" className="flex-1 overflow-hidden flex flex-col p-4 pt-0 mt-0">
            <div className="flex justify-between items-center py-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCreateUpcomingVisit}>
                  <Calendar className="h-4 w-4 mr-1" />
                  安排訪視
                </Button>
              </div>
              <Button size="sm" onClick={handleCreateVisitRecord}>
                <Plus className="h-4 w-4 mr-1" />
                新增紀錄
              </Button>
            </div>
            <div ref={visitRecordsScrollRef} className="flex-1 overflow-y-auto pr-2">
              {/* 待訪視通知區 */}
              {upcomingVisits.filter(v => v.status === 'pending').length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">待訪視</span>
                  </div>
                  <div className="space-y-2">
                    {upcomingVisits.filter(v => v.status === 'pending').map(visit => (
                      <div key={visit.id} className="flex items-center justify-between bg-white rounded px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {format(new Date(visit.plannedDate), "MM/dd", { locale: zhTW })}
                            {visit.plannedTime && ` ${visit.plannedTime.slice(0, 5)}`}
                          </span>
                          {visit.purpose && (
                            <span className="text-sm text-muted-foreground">{visit.purpose}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {visit.assignedUsers?.map(u => u.name).join("、")}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleCompleteVisit(visit.id)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleCancelVisit(visit.id)}
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLoadingRecords ? (
                <div className="text-center text-muted-foreground py-8">載入中...</div>
              ) : visitRecords.length === 0 && upcomingVisits.filter(v => v.status === 'pending').length === 0 ? (
                <div className="text-center text-muted-foreground py-8">尚無訪視紀錄</div>
              ) : visitRecords.length === 0 ? null : (
                <div className="space-y-4 pr-4">
                  {visitRecords.map((record) => (
                    <Card key={record.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(record.visitDate), "yyyy/MM/dd", { locale: zhTW })}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {[
                                ...(record.visitors?.map(v => v.name) || []),
                                ...(record.customVisitors || [])
                              ].join("、") || "未知"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditVisitRecord(record)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 text-base leading-relaxed">
                        {record.purpose && (
                          <div>
                            <p className="text-muted-foreground text-sm mb-1">訪視目的</p>
                            <p>{record.purpose}</p>
                          </div>
                        )}
                        {record.content && (
                          <div>
                            <p className="text-muted-foreground text-sm mb-1">訪視內容</p>
                            <p className="whitespace-pre-wrap">{record.content}</p>
                          </div>
                        )}

                        {/* 機構希望 & 基金會希望 */}
                        {(record.orgRequests || record.foundationRequests) && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            {record.orgRequests && (
                              <div className="p-4 bg-pink-50 border border-pink-100 rounded-lg">
                                <p className="text-pink-700 font-medium text-sm mb-2">機構希望</p>
                                <p className="whitespace-pre-wrap">{record.orgRequests}</p>
                              </div>
                            )}
                            {record.foundationRequests && (
                              <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
                                <p className="text-green-700 font-medium text-sm mb-2">基金會希望</p>
                                <p className="whitespace-pre-wrap">{record.foundationRequests}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 下一步 - 新格式 (always show for inline add) */}
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                          <p className="text-amber-700 font-medium text-sm mb-3">下一步</p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* 基金會下一步 */}
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">基金會</p>
                              <div className="space-y-2">
                                {record.nextStepsFoundation?.map(item => (
                                  <div key={item.id} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={item.completed}
                                      className="h-4 w-4 cursor-pointer"
                                      onCheckedChange={() => handleInlineToggleNextStep(record.id, 'foundation', item.id)}
                                    />
                                    <span className={cn("cursor-pointer", item.completed && "text-muted-foreground")}
                                      onClick={() => handleInlineToggleNextStep(record.id, 'foundation', item.id)}
                                    >
                                      {item.content}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {/* 內聯新增下一步 - 基金會 */}
                              {inlineNextStepRecordId === record.id && inlineNextStepType === 'foundation' ? (
                                <div className="flex gap-2 mt-2">
                                  <Input
                                    value={inlineNextStepContent}
                                    onChange={(e) => setInlineNextStepContent(e.target.value)}
                                    placeholder="新增下一步項目..."
                                    className="flex-1 h-8 text-sm"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleInlineAddNextStep(record.id, 'foundation')}
                                  />
                                  <Button size="sm" variant="outline" onClick={() => handleInlineAddNextStep(record.id, 'foundation')} className="h-8 px-2">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => preserveScrollPosition(() => setInlineNextStepRecordId(null))} className="h-8 px-2">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-sm text-amber-600 hover:text-amber-700 p-0 mt-2"
                                  onClick={() => preserveScrollPosition(() => {
                                    setInlineNextStepRecordId(record.id)
                                    setInlineNextStepType('foundation')
                                    setInlineNextStepContent("")
                                  })}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  新增
                                </Button>
                              )}
                            </div>
                            {/* 機構下一步 */}
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">{selectedOrg?.name}</p>
                              <div className="space-y-2">
                                {record.nextStepsOrg?.map(item => (
                                  <div key={item.id} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={item.completed}
                                      className="h-4 w-4 cursor-pointer"
                                      onCheckedChange={() => handleInlineToggleNextStep(record.id, 'org', item.id)}
                                    />
                                    <span className={cn("cursor-pointer", item.completed && "text-muted-foreground")}
                                      onClick={() => handleInlineToggleNextStep(record.id, 'org', item.id)}
                                    >
                                      {item.content}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {/* 內聯新增下一步 - 機構 */}
                              {inlineNextStepRecordId === record.id && inlineNextStepType === 'org' ? (
                                <div className="flex gap-2 mt-2">
                                  <Input
                                    value={inlineNextStepContent}
                                    onChange={(e) => setInlineNextStepContent(e.target.value)}
                                    placeholder="新增下一步項目..."
                                    className="flex-1 h-8 text-sm"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleInlineAddNextStep(record.id, 'org')}
                                  />
                                  <Button size="sm" variant="outline" onClick={() => handleInlineAddNextStep(record.id, 'org')} className="h-8 px-2">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => preserveScrollPosition(() => setInlineNextStepRecordId(null))} className="h-8 px-2">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-sm text-amber-600 hover:text-amber-700 p-0 mt-2"
                                  onClick={() => preserveScrollPosition(() => {
                                    setInlineNextStepRecordId(record.id)
                                    setInlineNextStepType('org')
                                    setInlineNextStepContent("")
                                  })}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  新增
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 舊的下一步欄位 */}
                        {record.nextSteps && !record.nextStepsFoundation?.length && !record.nextStepsOrg?.length && (
                          <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                            <p className="text-amber-700 font-medium text-sm mb-2">下一步 (舊格式)</p>
                            <p className="whitespace-pre-wrap">{record.nextSteps}</p>
                          </div>
                        )}

                        {/* 進度更新 - 新格式 */}
                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
                          <p className="text-purple-700 font-medium text-sm mb-3">進度更新</p>
                          {record.progressUpdates && record.progressUpdates.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {record.progressUpdates.map(item => (
                                <div key={item.id} className="flex gap-3">
                                  <span className="text-muted-foreground shrink-0">
                                    {format(new Date(item.date), "yyyy/MM/dd")}
                                  </span>
                                  <span>{item.content}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* 舊的進度更新欄位 */}
                          {record.progressUpdate && !record.progressUpdates?.length && (
                            <p className="whitespace-pre-wrap mb-3">{record.progressUpdate}</p>
                          )}
                          {/* 內聯新增進度 */}
                          {inlineProgressRecordId === record.id ? (
                            <div className="flex gap-2 mt-2">
                              <Input
                                type="date"
                                value={inlineProgressDate}
                                onChange={(e) => setInlineProgressDate(e.target.value)}
                                className="w-36 h-8 text-sm"
                              />
                              <Input
                                value={inlineProgressContent}
                                onChange={(e) => setInlineProgressContent(e.target.value)}
                                placeholder="進度內容..."
                                className="flex-1 h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleInlineAddProgress(record.id)}
                              />
                              <Button size="sm" variant="outline" onClick={() => handleInlineAddProgress(record.id)} className="h-8 px-2">
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => preserveScrollPosition(() => setInlineProgressRecordId(null))} className="h-8 px-2">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-sm text-purple-600 hover:text-purple-700 p-0"
                              onClick={() => preserveScrollPosition(() => {
                                setInlineProgressRecordId(record.id)
                                setInlineProgressDate(format(new Date(), "yyyy-MM-dd"))
                                setInlineProgressContent("")
                              })}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              新增進度
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          </Tabs>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">機構管理</h1>
          <p className="text-muted-foreground">管理合作機構與訪視紀錄</p>
        </div>
      </div>

      {/* Pending Visits Alert */}
      {pendingVisits.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800">
              <Clock className="h-4 w-4" />
              近期待訪視
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingVisits.slice(0, 3).map(visit => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between text-sm cursor-pointer hover:bg-amber-100 rounded px-2 py-1 -mx-2"
                  onClick={() => {
                    const org = organizations.find(o => o.id === visit.organizationId)
                    if (org) handleSelectOrg(org)
                  }}
                >
                  <div>
                    <span className="font-medium">{visit.organization?.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(visit.plannedDate), "MM/dd")}
                      {visit.plannedTime && ` ${visit.plannedTime.slice(0, 5)}`}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {visit.assignedUsers?.map(u => u.name).join("、")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Split Panel Layout */}
      <Card className="h-[calc(100%-8rem)] overflow-hidden">
        {/* Desktop: Side by side */}
        <div className="hidden md:flex h-full">
          {/* Left Panel - 30% */}
          <div className="w-[30%] border-r h-full">
            <OrganizationListPanel />
          </div>
          {/* Right Panel - 70% */}
          <div className="w-[70%] h-full">
            <OrganizationDetailPanel />
          </div>
        </div>

        {/* Mobile: Single column with view switching */}
        <div className="md:hidden h-full">
          {mobileView === "list" ? (
            <OrganizationListPanel />
          ) : (
            <OrganizationDetailPanel />
          )}
        </div>
      </Card>

      {/* Create/Edit Organization Dialog */}
      <Dialog open={isOrgDialogOpen} onOpenChange={setIsOrgDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOrg ? "編輯機構" : "新增機構"}</DialogTitle>
            <DialogDescription>
              {editingOrg ? "修改機構基本資料" : "建立新的合作機構"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">機構名稱 *</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={(e) => setOrgForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例：慈光基金會"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-category">機構類型</Label>
                <Select
                  value={orgForm.categoryName}
                  onValueChange={(v) => setOrgForm(prev => ({ ...prev, categoryName: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-cooperation">合作狀態</Label>
                <Select
                  value={orgForm.cooperationStatus}
                  onValueChange={(v) => setOrgForm(prev => ({ ...prev, cooperationStatus: v as CooperationStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cooperating">合作</SelectItem>
                    <SelectItem value="not_cooperating">不合作</SelectItem>
                    <SelectItem value="referral_only">僅轉介個案</SelectItem>
                    <SelectItem value="evaluating">討論評估中</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-contact">聯絡窗口</Label>
              <Input
                id="org-contact"
                value={orgForm.contactPerson}
                onChange={(e) => setOrgForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="陳主任"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-address">地址</Label>
                <Input
                  id="org-address"
                  value={orgForm.address}
                  onChange={(e) => setOrgForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="台北市..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address-url">Google Maps 連結</Label>
                <Input
                  id="org-address-url"
                  value={orgForm.addressUrl}
                  onChange={(e) => setOrgForm(prev => ({ ...prev, addressUrl: e.target.value }))}
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-phone">電話</Label>
                <Input
                  id="org-phone"
                  value={orgForm.phone}
                  onChange={(e) => setOrgForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="02-1234-5678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-line">LINE</Label>
                <Input
                  id="org-line"
                  value={orgForm.lineId}
                  onChange={(e) => setOrgForm(prev => ({ ...prev, lineId: e.target.value }))}
                  placeholder="LINE ID"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-website">網站</Label>
              <Input
                id="org-website"
                value={orgForm.website}
                onChange={(e) => setOrgForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>對接計畫</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[42px]">
                {plans.filter(p => p.status === 'active').map(plan => (
                  <Badge
                    key={plan.id}
                    variant={orgForm.planIds.includes(plan.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePlanSelection(plan.id)}
                  >
                    {plan.name}
                  </Badge>
                ))}
                {plans.filter(p => p.status === 'active').length === 0 && (
                  <span className="text-sm text-muted-foreground">尚無可選計畫</span>
                )}
              </div>
              {orgForm.planIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  已選擇 {orgForm.planIds.length} 個計畫
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-notes">附註</Label>
              <textarea
                id="org-notes"
                value={orgForm.notes}
                onChange={(e) => setOrgForm(prev => ({ ...prev, notes: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="其他備註..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrgDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitOrg} disabled={isSubmitting}>
              {isSubmitting ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Visit Record Dialog */}
      <Dialog open={isVisitDialogOpen} onOpenChange={setIsVisitDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVisit ? "編輯訪視紀錄" : "新增訪視紀錄"}</DialogTitle>
            <DialogDescription>
              記錄對 {selectedOrg?.name} 的訪視內容
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visit-date">訪視日期 *</Label>
                <Input
                  id="visit-date"
                  type="date"
                  value={visitForm.visitDate}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, visitDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>訪視人員 *</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md max-h-24 overflow-y-auto">
                  {allUsers.map(u => (
                    <Badge
                      key={u.id}
                      variant={visitForm.visitorIds.includes(u.id) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleVisitor(u.id)}
                    >
                      {u.name}
                    </Badge>
                  ))}
                  {visitForm.customVisitors.map(name => (
                    <Badge
                      key={name}
                      variant="default"
                      className="cursor-pointer text-xs bg-blue-600 hover:bg-blue-700"
                      onClick={() => removeCustomVisitor(name)}
                    >
                      {name} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newCustomVisitor}
                    onChange={(e) => setNewCustomVisitor(e.target.value)}
                    placeholder="手動輸入人員..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomVisitor())}
                  />
                  <Button size="sm" variant="outline" onClick={addCustomVisitor} className="h-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit-purpose">訪視目的</Label>
              <Input
                id="visit-purpose"
                value={visitForm.purpose}
                onChange={(e) => setVisitForm(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="例：建立合作關係、了解服務需求"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit-content">訪視內容</Label>
              <textarea
                id="visit-content"
                value={visitForm.content}
                onChange={(e) => setVisitForm(prev => ({ ...prev, content: e.target.value }))}
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="會談重點、訪視目的..."
              />
            </div>

            <Separator />

            {/* 機構希望 & 基金會希望 */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visit-org-req" className="text-pink-700">機構希望</Label>
                <textarea
                  id="visit-org-req"
                  value={visitForm.orgRequests}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, orgRequests: e.target.value }))}
                  className="flex min-h-28 w-full rounded-md border border-pink-200 bg-pink-50/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pink-300"
                  placeholder="機構的需求或期望..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="visit-found-req" className="text-green-700">基金會希望</Label>
                <textarea
                  id="visit-found-req"
                  value={visitForm.foundationRequests}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, foundationRequests: e.target.value }))}
                  className="flex min-h-28 w-full rounded-md border border-green-200 bg-green-50/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-300"
                  placeholder="基金會想合作的方向..."
                />
              </div>
            </div>

            <Separator />

            {/* 下一步 */}
            <div className="space-y-3">
              <Label>下一步</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* 基金會下一步 */}
                <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm font-medium">基金會</p>
                  <div className="space-y-2">
                    {visitForm.nextStepsFoundation.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleNextStepFoundation(item.id)}
                        />
                        <span className={cn("flex-1 text-sm", item.completed && "text-muted-foreground")}>
                          {item.content}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeNextStepFoundation(item.id)}
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newNextStepFoundation}
                      onChange={(e) => setNewNextStepFoundation(e.target.value)}
                      placeholder="新增項目..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNextStepFoundation())}
                    />
                    <Button size="sm" variant="outline" onClick={addNextStepFoundation} className="h-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 機構下一步 */}
                <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm font-medium">{selectedOrg?.name || "機構"}</p>
                  <div className="space-y-2">
                    {visitForm.nextStepsOrg.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleNextStepOrg(item.id)}
                        />
                        <span className={cn("flex-1 text-sm", item.completed && "text-muted-foreground")}>
                          {item.content}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeNextStepOrg(item.id)}
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newNextStepOrg}
                      onChange={(e) => setNewNextStepOrg(e.target.value)}
                      placeholder="新增項目..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNextStepOrg())}
                    />
                    <Button size="sm" variant="outline" onClick={addNextStepOrg} className="h-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 進度更新 */}
            <div className="space-y-3">
              <Label>進度更新</Label>
              <div className="space-y-2">
                {visitForm.progressUpdates.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                    <span className="text-sm font-medium text-muted-foreground shrink-0">
                      {format(new Date(item.date), "yyyy/MM/dd")}
                    </span>
                    <span className="flex-1 text-sm">{item.content}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeProgressUpdate(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newProgressDate}
                  onChange={(e) => setNewProgressDate(e.target.value)}
                  className="w-36 h-8 text-sm"
                />
                <Input
                  value={newProgressContent}
                  onChange={(e) => setNewProgressContent(e.target.value)}
                  placeholder="進度內容..."
                  className="flex-1 h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProgressUpdate())}
                />
                <Button size="sm" variant="outline" onClick={addProgressUpdate} className="h-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVisitDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitVisitRecord} disabled={isSubmitting}>
              {isSubmitting ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Upcoming Visit Dialog */}
      <Dialog open={isUpcomingDialogOpen} onOpenChange={setIsUpcomingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增待訪視</DialogTitle>
            <DialogDescription>
              為 {selectedOrg?.name} 安排訪視日程
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="upcoming-date">預計日期 *</Label>
                <Input
                  id="upcoming-date"
                  type="date"
                  value={upcomingForm.plannedDate}
                  onChange={(e) => setUpcomingForm(prev => ({ ...prev, plannedDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upcoming-time">預計時間</Label>
                <Input
                  id="upcoming-time"
                  type="time"
                  value={upcomingForm.plannedTime}
                  onChange={(e) => setUpcomingForm(prev => ({ ...prev, plannedTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>負責人員 *</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {allUsers.map(u => (
                  <Badge
                    key={u.id}
                    variant={upcomingForm.assignedUserIds.includes(u.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleAssignedUser(u.id)}
                  >
                    {u.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upcoming-purpose">訪視重點</Label>
              <Input
                id="upcoming-purpose"
                value={upcomingForm.purpose}
                onChange={(e) => setUpcomingForm(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="例：討論合作細節"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="upcoming-notes">備註</Label>
              <textarea
                id="upcoming-notes"
                value={upcomingForm.notes}
                onChange={(e) => setUpcomingForm(prev => ({ ...prev, notes: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="其他備註..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpcomingDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitUpcomingVisit} disabled={isSubmitting}>
              {isSubmitting ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Upcoming Visit Dialog (from left panel, needs org selection) */}
      <Dialog open={isQuickUpcomingDialogOpen} onOpenChange={setIsQuickUpcomingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增待訪視</DialogTitle>
            <DialogDescription>
              選擇機構並安排訪視日程
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Organization Selection Mode */}
            <div className="space-y-2">
              <Label>機構 *</Label>
              <div className="flex gap-2 mb-2">
                <Badge
                  variant={quickUpcomingOrgMode === "select" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setQuickUpcomingOrgMode("select")}
                >
                  選擇現有機構
                </Badge>
                <Badge
                  variant={quickUpcomingOrgMode === "new" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setQuickUpcomingOrgMode("new")}
                >
                  新增機構
                </Badge>
              </div>

              {quickUpcomingOrgMode === "select" ? (
                <Select value={quickUpcomingOrgId} onValueChange={setQuickUpcomingOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇要訪視的機構" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...organizations]
                      .sort((a, b) => {
                        // 不合作的排最後
                        if (a.cooperationStatus === 'not_cooperating' && b.cooperationStatus !== 'not_cooperating') return 1
                        if (a.cooperationStatus !== 'not_cooperating' && b.cooperationStatus === 'not_cooperating') return -1
                        // 其他按建立時間新到舊排序
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      })
                      .map(org => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} ({OrganizationCategoryLabels[org.category]})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={quickUpcomingNewOrgName}
                  onChange={(e) => setQuickUpcomingNewOrgName(e.target.value)}
                  placeholder="輸入新機構名稱"
                />
              )}
              {quickUpcomingOrgMode === "new" && (
                <p className="text-xs text-muted-foreground">
                  將自動建立新機構，其他資料可稍後編輯
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-upcoming-date">預計日期 *</Label>
                <Input
                  id="quick-upcoming-date"
                  type="date"
                  value={quickUpcomingForm.plannedDate}
                  onChange={(e) => setQuickUpcomingForm(prev => ({ ...prev, plannedDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-upcoming-time">預計時間</Label>
                <Input
                  id="quick-upcoming-time"
                  type="time"
                  value={quickUpcomingForm.plannedTime}
                  onChange={(e) => setQuickUpcomingForm(prev => ({ ...prev, plannedTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>負責人員 *</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {allUsers.map(u => (
                  <Badge
                    key={u.id}
                    variant={quickUpcomingForm.assignedUserIds.includes(u.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleQuickUpcomingUser(u.id)}
                  >
                    {u.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-upcoming-purpose">訪視目的</Label>
              <Input
                id="quick-upcoming-purpose"
                value={quickUpcomingForm.purpose}
                onChange={(e) => setQuickUpcomingForm(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="例：討論合作細節、初次拜訪"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-upcoming-notes">備註</Label>
              <textarea
                id="quick-upcoming-notes"
                value={quickUpcomingForm.notes}
                onChange={(e) => setQuickUpcomingForm(prev => ({ ...prev, notes: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="其他備註..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickUpcomingDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitQuickUpcomingVisit} disabled={isSubmitting || (quickUpcomingOrgMode === "select" && !quickUpcomingOrgId) || (quickUpcomingOrgMode === "new" && !quickUpcomingNewOrgName.trim())}>
              {isSubmitting ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subsidy Record Dialog */}
      <Dialog open={isSubsidyDialogOpen} onOpenChange={setIsSubsidyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSubsidy ? "編輯補助紀錄" : "新增補助紀錄"}</DialogTitle>
            <DialogDescription>
              記錄對 {selectedOrg?.name} 的補助
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subsidy-items">補助項目 *</Label>
              <Input
                id="subsidy-items"
                value={subsidyForm.subsidyItems}
                onChange={(e) => setSubsidyForm(prev => ({ ...prev, subsidyItems: e.target.value }))}
                placeholder="例：冬之旅+外牆及小家修繕"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subsidy-amount">補助金額</Label>
                <Input
                  id="subsidy-amount"
                  type="number"
                  value={subsidyForm.subsidyAmount}
                  onChange={(e) => setSubsidyForm(prev => ({ ...prev, subsidyAmount: e.target.value }))}
                  placeholder="170000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subsidy-date">補助日期</Label>
                <Input
                  id="subsidy-date"
                  type="date"
                  value={subsidyForm.subsidyDate}
                  onChange={(e) => setSubsidyForm(prev => ({ ...prev, subsidyDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subsidy-delivery-method">交付方式</Label>
                <Input
                  id="subsidy-delivery-method"
                  value={subsidyForm.deliveryMethod}
                  onChange={(e) => setSubsidyForm(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                  placeholder="例：現金、匯款、mail"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subsidy-delivery-status">交付狀態</Label>
                <Input
                  id="subsidy-delivery-status"
                  value={subsidyForm.deliveryStatus}
                  onChange={(e) => setSubsidyForm(prev => ({ ...prev, deliveryStatus: e.target.value }))}
                  placeholder="例：已現場交付、待匯款"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subsidy-notes">備註</Label>
              <textarea
                id="subsidy-notes"
                value={subsidyForm.notes}
                onChange={(e) => setSubsidyForm(prev => ({ ...prev, notes: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="例：感謝狀冬之旅(12/19-12/20)帶去拍照"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubsidyDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitSubsidy} disabled={isSubmitting}>
              {isSubmitting ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subsidy List Dialog - 補助清單 */}
      <Dialog open={isSubsidyListDialogOpen} onOpenChange={setIsSubsidyListDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>補助清單</DialogTitle>
            <DialogDescription>
              所有機構的補助紀錄
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoadingSubsidyList ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : allSubsidyRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">尚無補助紀錄</div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">機構名稱</th>
                    <th className="text-left p-3 font-medium">補助項目</th>
                    <th className="text-right p-3 font-medium">金額</th>
                    <th className="text-center p-3 font-medium">日期</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubsidyRecords.map(record => (
                    <tr key={record.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <span className="font-medium">{record.organization?.name || '-'}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {record.subsidyItems}
                      </td>
                      <td className="p-3 text-right">
                        {record.subsidyAmount ? `$${record.subsidyAmount.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3 text-center text-muted-foreground">
                        {record.subsidyDate ? format(new Date(record.subsidyDate), "yyyy/MM/dd") : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubsidyListDialogOpen(false)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Modal - 彈窗視窗 (使用共用元件) */}
      {isProjectModalOpen && selectedProject && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setIsProjectModalOpen(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-xl w-full max-w-4xl h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ProjectDetailView
              project={selectedProject}
              organization={selectedOrg}
              onClose={() => setIsProjectModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
