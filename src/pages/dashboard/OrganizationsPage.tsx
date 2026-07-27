import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
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
import { organizationService, userService, projectService } from "@/services"
import { useAuth } from "@/contexts/AuthContext"
import type {
  OrganizationWithDetails,
  VisitRecordWithDetails,
  UpcomingVisitWithDetails,
  OrganizationCategory,
  User,
  Project,
} from "@/types"
import { OrganizationCategoryLabels, VisitStatusLabels } from "@/types"
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
  FolderKanban,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function OrganizationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState<OrganizationWithDetails[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<OrganizationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  // Projects for linking
  const [projects, setProjects] = useState<Project[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])

  // Split panel state
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithDetails | null>(null)
  const [visitRecords, setVisitRecords] = useState<VisitRecordWithDetails[]>([])
  const [upcomingVisits, setUpcomingVisits] = useState<UpcomingVisitWithDetails[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)

  // Mobile view state (for responsive single-column switching)
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")

  // Create/Edit organization dialog
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<OrganizationWithDetails | null>(null)
  const [orgForm, setOrgForm] = useState({
    name: "",
    category: "other" as OrganizationCategory,
    contactPerson: "",
    address: "",
    phone: "",
    website: "",
    lineId: "",
    notes: "",
    projectId: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Create visit record dialog
  const [isVisitDialogOpen, setIsVisitDialogOpen] = useState(false)
  const [visitForm, setVisitForm] = useState({
    visitDate: format(new Date(), "yyyy-MM-dd"),
    visitorIds: [] as string[],
    purpose: "",
    content: "",
    orgRequests: "",
    foundationRequests: "",
    nextSteps: "",
    progressUpdate: "",
  })

  // Quick upcoming visit dialog (from left panel, needs org selection)
  const [isQuickUpcomingDialogOpen, setIsQuickUpcomingDialogOpen] = useState(false)
  const [quickUpcomingOrgId, setQuickUpcomingOrgId] = useState<string>("")
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

  // Pending upcoming visits for dashboard
  const [pendingVisits, setPendingVisits] = useState<UpcomingVisitWithDetails[]>([])

  // Compute related projects for selected organization
  const relatedProjects = useMemo(() => {
    if (!selectedOrg) return []
    return projects.filter(p => p.organizationId === selectedOrg.id)
  }, [selectedOrg, projects])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [orgsData, projectsData, usersData, pendingData] = await Promise.all([
        organizationService.getOrganizations(),
        projectService.getProjects(),
        userService.getUsers(),
        organizationService.getPendingUpcomingVisits(),
      ])
      setOrganizations(orgsData)
      setFilteredOrganizations(orgsData)
      setProjects(projectsData)
      setAllUsers(usersData)
      setPendingVisits(pendingData)

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
      result = result.filter((o) => o.category === categoryFilter)
    }

    setFilteredOrganizations(result)
  }, [organizations, searchQuery, categoryFilter])

  const handleSelectOrg = async (org: OrganizationWithDetails) => {
    setSelectedOrg(org)
    setMobileView("detail")
    setIsLoadingRecords(true)

    try {
      const [records, upcoming] = await Promise.all([
        organizationService.getVisitRecords(org.id),
        organizationService.getUpcomingVisits(org.id),
      ])
      setVisitRecords(records)
      setUpcomingVisits(upcoming)
    } catch (error) {
      console.error("Failed to load records:", error)
    } finally {
      setIsLoadingRecords(false)
    }
  }

  const handleBackToList = () => {
    setMobileView("list")
  }

  const handleCreateOrg = () => {
    setEditingOrg(null)
    setOrgForm({
      name: "",
      category: "other",
      contactPerson: "",
      address: "",
      phone: "",
      website: "",
      lineId: "",
      notes: "",
      projectId: "",
    })
    setIsOrgDialogOpen(true)
  }

  const handleEditOrg = (org: OrganizationWithDetails) => {
    setEditingOrg(org)
    setOrgForm({
      name: org.name,
      category: org.category,
      contactPerson: org.contactPerson || "",
      address: org.address || "",
      phone: org.phone || "",
      website: org.website || "",
      lineId: org.lineId || "",
      notes: org.notes || "",
      projectId: org.projectId || "",
    })
    setIsOrgDialogOpen(true)
  }

  const handleSubmitOrg = async () => {
    if (!orgForm.name.trim()) {
      alert("請輸入機構名稱")
      return
    }

    setIsSubmitting(true)
    try {
      if (editingOrg) {
        await organizationService.updateOrganization(editingOrg.id, {
          ...orgForm,
          projectId: orgForm.projectId || undefined,
        })
      } else {
        await organizationService.createOrganization({
          ...orgForm,
          projectId: orgForm.projectId || undefined,
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

  const handleCreateVisitRecord = () => {
    setVisitForm({
      visitDate: format(new Date(), "yyyy-MM-dd"),
      visitorIds: [],
      purpose: "",
      content: "",
      orgRequests: "",
      foundationRequests: "",
      nextSteps: "",
      progressUpdate: "",
    })
    setIsVisitDialogOpen(true)
  }

  // Quick upcoming visit from left panel (needs to select organization)
  const handleQuickCreateUpcoming = () => {
    setQuickUpcomingOrgId("")
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
    if (visitForm.visitorIds.length === 0) {
      alert("請選擇訪視人員")
      return
    }

    setIsSubmitting(true)
    try {
      await organizationService.createVisitRecord({
        organizationId: selectedOrg.id,
        ...visitForm,
        createdBy: user!.id,
      })

      // Reload records
      const records = await organizationService.getVisitRecords(selectedOrg.id)
      setVisitRecords(records)

      setIsVisitDialogOpen(false)
      await loadData() // Refresh stats
    } catch (error) {
      console.error("Failed to create visit record:", error)
      alert("新增失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit quick upcoming visit (from left panel with org selection)
  const handleSubmitQuickUpcomingVisit = async () => {
    if (!quickUpcomingOrgId) {
      alert("請選擇機構")
      return
    }
    if (quickUpcomingForm.assignedUserIds.length === 0) {
      alert("請選擇負責人員")
      return
    }

    setIsSubmitting(true)
    try {
      await organizationService.createUpcomingVisit({
        organizationId: quickUpcomingOrgId,
        ...quickUpcomingForm,
        plannedTime: quickUpcomingForm.plannedTime || undefined,
        status: "pending",
        createdBy: user!.id,
      })

      // Reload upcoming visits if we have a selected org that matches
      if (selectedOrg && selectedOrg.id === quickUpcomingOrgId) {
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
        <h1 className="text-3xl font-bold">機構管理</h1>
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="機構類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部類型</SelectItem>
              <SelectItem value="orphanage">育幼院</SelectItem>
              <SelectItem value="association">協會</SelectItem>
              <SelectItem value="school">學校</SelectItem>
              <SelectItem value="hospital">醫療機構</SelectItem>
              <SelectItem value="other">其他</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>共 {filteredOrganizations.length} 間</span>
          {pendingVisits.length > 0 && (
            <Badge variant="warning" className="text-xs">
              {pendingVisits.length} 待訪視
            </Badge>
          )}
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
                  "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedOrg?.id === org.id && "bg-muted"
                )}
                onClick={() => handleSelectOrg(org)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{org.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {OrganizationCategoryLabels[org.category]}
                      </Badge>
                    </div>
                    {org.contactPerson && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {org.contactPerson}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {(org.upcomingVisitCount || 0) > 0 && (
                      <Badge variant="warning" className="text-xs">
                        {org.upcomingVisitCount} 待訪
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
                  {OrganizationCategoryLabels[selectedOrg.category]}
                </Badge>
                {relatedProjects.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <FolderKanban className="h-3 w-3 mr-1" />
                    {relatedProjects.length} 個專案
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
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{selectedOrg.address}</span>
                  </span>
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

        {/* Tabs Content - projects, records, and upcoming */}
        <Tabs defaultValue="projects" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="projects">相關專案 ({relatedProjects.length})</TabsTrigger>
              <TabsTrigger value="records">訪視紀錄 ({visitRecords.length})</TabsTrigger>
              <TabsTrigger value="upcoming">待訪視 ({upcomingVisits.filter(v => v.status === 'pending').length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="projects" className="flex-1 overflow-hidden flex flex-col p-4 pt-0 mt-0">
            <ScrollArea className="flex-1 mt-2">
              {isLoadingRecords ? (
                <div className="text-center text-muted-foreground py-8">載入中...</div>
              ) : relatedProjects.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">尚無相關專案</div>
              ) : (
                <div className="space-y-3 pr-4">
                  {relatedProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/dashboard/plans?project=${project.id}`)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{project.name}</span>
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

          <TabsContent value="records" className="flex-1 overflow-hidden flex flex-col p-4 pt-0 mt-0">
            <div className="flex justify-end py-2">
              <Button size="sm" onClick={handleCreateVisitRecord}>
                <Plus className="h-4 w-4 mr-1" />
                新增訪視紀錄
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {isLoadingRecords ? (
                <div className="text-center text-muted-foreground py-8">載入中...</div>
              ) : visitRecords.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">尚無訪視紀錄</div>
              ) : (
                <div className="space-y-4 pr-4">
                  {visitRecords.map((record) => (
                    <Card key={record.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(record.visitDate), "yyyy/MM/dd", { locale: zhTW })}
                          </CardTitle>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {record.visitors?.map(v => v.name).join("、") || "未知"}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {record.purpose && (
                          <div>
                            <p className="text-muted-foreground">訪視目的</p>
                            <p>{record.purpose}</p>
                          </div>
                        )}
                        {record.content && (
                          <div>
                            <p className="text-muted-foreground">訪視內容</p>
                            <p className="whitespace-pre-wrap">{record.content}</p>
                          </div>
                        )}
                        {record.orgRequests && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-blue-800 font-medium text-xs mb-1">機構希望</p>
                            <p className="whitespace-pre-wrap">{record.orgRequests}</p>
                          </div>
                        )}
                        {record.foundationRequests && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-green-800 font-medium text-xs mb-1">基金會希望</p>
                            <p className="whitespace-pre-wrap">{record.foundationRequests}</p>
                          </div>
                        )}
                        {record.nextSteps && (
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <p className="text-amber-800 font-medium text-xs mb-1">下一步</p>
                            <p className="whitespace-pre-wrap">{record.nextSteps}</p>
                          </div>
                        )}
                        {record.progressUpdate && (
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <p className="text-purple-800 font-medium text-xs mb-1">進度更新</p>
                            <p className="whitespace-pre-wrap">{record.progressUpdate}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upcoming" className="flex-1 overflow-hidden flex flex-col p-4 pt-0 mt-0">
            <div className="flex justify-end py-2">
              <Button size="sm" onClick={handleCreateUpcomingVisit}>
                <Plus className="h-4 w-4 mr-1" />
                新增待訪視
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {isLoadingRecords ? (
                <div className="text-center text-muted-foreground py-8">載入中...</div>
              ) : upcomingVisits.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">尚無待訪視日程</div>
              ) : (
                <div className="space-y-3 pr-4">
                  {upcomingVisits.map((visit) => (
                    <Card key={visit.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(visit.plannedDate), "yyyy/MM/dd", { locale: zhTW })}
                              </span>
                              {visit.plannedTime && (
                                <span className="text-muted-foreground">
                                  {visit.plannedTime.slice(0, 5)}
                                </span>
                              )}
                              <Badge variant={
                                visit.status === 'pending' ? 'warning' :
                                visit.status === 'completed' ? 'success' : 'secondary'
                              }>
                                {VisitStatusLabels[visit.status]}
                              </Badge>
                            </div>
                            {visit.purpose && (
                              <p className="text-sm text-muted-foreground">{visit.purpose}</p>
                            )}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {visit.assignedUsers?.map(u => u.name).join("、") || "未指派"}
                            </div>
                          </div>
                          {visit.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCompleteVisit(visit.id)}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelVisit(visit.id)}
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
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
          <h1 className="text-3xl font-bold">機構管理</h1>
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
                  value={orgForm.category}
                  onValueChange={(v) => setOrgForm(prev => ({ ...prev, category: v as OrganizationCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orphanage">育幼院</SelectItem>
                    <SelectItem value="association">協會</SelectItem>
                    <SelectItem value="school">學校</SelectItem>
                    <SelectItem value="hospital">醫療機構</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-address">地址</Label>
              <Input
                id="org-address"
                value={orgForm.address}
                onChange={(e) => setOrgForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="台北市..."
              />
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
              <Label htmlFor="org-project">對接計畫</Label>
              <Select
                value={orgForm.projectId}
                onValueChange={(v) => setOrgForm(prev => ({ ...prev, projectId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇計畫（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">無</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Create Visit Record Dialog */}
      <Dialog open={isVisitDialogOpen} onOpenChange={setIsVisitDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增訪視紀錄</DialogTitle>
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
            </div>

            <div className="space-y-2">
              <Label>訪視人員 *</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {allUsers.map(u => (
                  <Badge
                    key={u.id}
                    variant={visitForm.visitorIds.includes(u.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleVisitor(u.id)}
                  >
                    {u.name}
                  </Badge>
                ))}
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
                placeholder="詳細記錄訪視過程..."
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="visit-org-req">機構希望</Label>
              <textarea
                id="visit-org-req"
                value={visitForm.orgRequests}
                onChange={(e) => setVisitForm(prev => ({ ...prev, orgRequests: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="機構的需求或期望..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit-found-req">基金會希望</Label>
              <textarea
                id="visit-found-req"
                value={visitForm.foundationRequests}
                onChange={(e) => setVisitForm(prev => ({ ...prev, foundationRequests: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="基金會想合作的方向..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit-next">下一步</Label>
              <textarea
                id="visit-next"
                value={visitForm.nextSteps}
                onChange={(e) => setVisitForm(prev => ({ ...prev, nextSteps: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="後續行動計畫..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit-progress">進度更新</Label>
              <textarea
                id="visit-progress"
                value={visitForm.progressUpdate}
                onChange={(e) => setVisitForm(prev => ({ ...prev, progressUpdate: e.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="最新進度..."
              />
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
            {/* Organization Selection */}
            <div className="space-y-2">
              <Label>選擇機構 *</Label>
              <Select value={quickUpcomingOrgId} onValueChange={setQuickUpcomingOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇要訪視的機構" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({OrganizationCategoryLabels[org.category]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button onClick={handleSubmitQuickUpcomingVisit} disabled={isSubmitting || !quickUpcomingOrgId}>
              {isSubmitting ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
