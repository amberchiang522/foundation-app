import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { settingsService, projectService } from "@/services"
import type { SystemSettings, AdminTag, ProjectType, WorkflowTemplate, WorkflowStep } from "@/types"
import { Plus, Pencil, Trash2, Settings, Users, FileText, GitBranch } from "lucide-react"

export function SettingsPage() {
  const [, setSettings] = useState<SystemSettings | null>(null)
  const [adminTags, setAdminTags] = useState<AdminTag[]>([])
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // General settings
  const [ageThreshold, setAgeThreshold] = useState(30)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Admin Tag Dialog
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null)
  const [tagForm, setTagForm] = useState({ name: "", description: "" })
  const [isSavingTag, setIsSavingTag] = useState(false)

  // Project Type Dialog
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ProjectType | null>(null)
  const [typeForm, setTypeForm] = useState({ name: "", budgetMin: 0, budgetMax: 0 })
  const [isSavingType, setIsSavingType] = useState(false)

  // Workflow Template Dialog
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: "", description: "" })
  const [templateSteps, setTemplateSteps] = useState<WorkflowStep[]>([])
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [settingsData, tagsData, typesData, templatesData] = await Promise.all([
        settingsService.getSettings(),
        settingsService.getAdminTags(),
        projectService.getProjectTypes(),
        projectService.getWorkflowTemplates(),
      ])
      setSettings(settingsData)
      setAgeThreshold(settingsData.youthAgeThreshold)
      setAdminTags(tagsData)
      setProjectTypes(typesData)
      setWorkflowTemplates(templatesData)
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // === General Settings ===
  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      await settingsService.updateSettings({ youthAgeThreshold: ageThreshold })
      alert("設定已儲存")
    } catch (error) {
      console.error("Failed to save settings:", error)
      alert("儲存失敗")
    } finally {
      setIsSavingSettings(false)
    }
  }

  // === Admin Tags ===
  const openTagDialog = (tag?: AdminTag) => {
    setEditingTag(tag || null)
    setTagForm({
      name: tag?.name || "",
      description: tag?.description || "",
    })
    setIsTagDialogOpen(true)
  }

  const handleSaveTag = async () => {
    if (!tagForm.name.trim()) {
      alert("請填寫標籤名稱")
      return
    }

    setIsSavingTag(true)
    try {
      if (editingTag) {
        await settingsService.updateAdminTag(editingTag.id, tagForm)
      } else {
        await settingsService.createAdminTag(tagForm)
      }
      await loadData()
      setIsTagDialogOpen(false)
    } catch (error) {
      console.error("Failed to save tag:", error)
      alert("儲存失敗")
    } finally {
      setIsSavingTag(false)
    }
  }

  const handleDeleteTag = async (tag: AdminTag) => {
    if (!confirm(`確定要刪除標籤「${tag.name}」嗎？`)) return

    try {
      await settingsService.deleteAdminTag(tag.id)
      await loadData()
    } catch (error) {
      console.error("Failed to delete tag:", error)
    }
  }

  // === Project Types ===
  const openTypeDialog = (type?: ProjectType) => {
    setEditingType(type || null)
    setTypeForm({
      name: type?.name || "",
      budgetMin: type?.budgetMin || 0,
      budgetMax: type?.budgetMax || 0,
    })
    setIsTypeDialogOpen(true)
  }

  const handleSaveType = async () => {
    if (!typeForm.name.trim()) {
      alert("請填寫類型名稱")
      return
    }

    if (typeForm.budgetMin > typeForm.budgetMax) {
      alert("最低額度不能大於最高額度")
      return
    }

    setIsSavingType(true)
    try {
      if (editingType) {
        await projectService.updateProjectType(editingType.id, typeForm)
      } else {
        await projectService.createProjectType(typeForm)
      }
      await loadData()
      setIsTypeDialogOpen(false)
    } catch (error) {
      console.error("Failed to save type:", error)
      alert("儲存失敗")
    } finally {
      setIsSavingType(false)
    }
  }

  const handleDeleteType = async (type: ProjectType) => {
    if (!confirm(`確定要刪除類型「${type.name}」嗎？`)) return

    try {
      await projectService.deleteProjectType(type.id)
      await loadData()
    } catch (error) {
      console.error("Failed to delete type:", error)
    }
  }

  // === Workflow Templates ===
  const openTemplateDialog = (template?: WorkflowTemplate) => {
    setEditingTemplate(template || null)
    setTemplateForm({
      name: template?.name || "",
      description: template?.description || "",
    })
    setTemplateSteps(
      template?.steps || [
        { id: "step-1", name: "提案", type: "status" },
        { id: "step-2", name: "審核", type: "approval" },
        { id: "step-3", name: "執行", type: "status" },
        { id: "step-4", name: "結案", type: "status" },
      ]
    )
    setIsTemplateDialogOpen(true)
  }

  const addTemplateStep = () => {
    setTemplateSteps([
      ...templateSteps,
      { id: `step-${Date.now()}`, name: "新步驟", type: "status" },
    ])
  }

  const updateTemplateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const newSteps = [...templateSteps]
    newSteps[index] = { ...newSteps[index], ...updates }
    setTemplateSteps(newSteps)
  }

  const removeTemplateStep = (index: number) => {
    if (templateSteps.length <= 2) {
      alert("至少需要 2 個步驟")
      return
    }
    setTemplateSteps(templateSteps.filter((_, i) => i !== index))
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      alert("請填寫範本名稱")
      return
    }

    if (templateSteps.length < 2) {
      alert("至少需要 2 個步驟")
      return
    }

    setIsSavingTemplate(true)
    try {
      await projectService.createWorkflowTemplate({
        name: templateForm.name,
        description: templateForm.description,
        steps: templateSteps,
      })
      await loadData()
      setIsTemplateDialogOpen(false)
    } catch (error) {
      console.error("Failed to save template:", error)
      alert("儲存失敗")
    } finally {
      setIsSavingTemplate(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">系統設定</h1>
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
        <h1 className="text-3xl font-bold">系統設定</h1>
        <p className="text-muted-foreground">管理系統參數與設定</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">一般設定</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">管理員標籤</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">專案類型</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">流程範本</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>志工年齡設定</CardTitle>
              <CardDescription>
                設定青年志工與社會志工的年齡分界
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label>年齡分界</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={ageThreshold}
                      onChange={(e) => setAgeThreshold(parseInt(e.target.value) || 30)}
                      className="w-24"
                      min={18}
                      max={65}
                    />
                    <span className="text-muted-foreground">歲</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    未滿此年齡為青年志工 (Y-)，達此年齡以上為社會志工 (S-)
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                {isSavingSettings ? "儲存中..." : "儲存設定"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Tags */}
        <TabsContent value="tags" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>管理員標籤</CardTitle>
                <CardDescription>
                  用於指派審批權限的管理員標籤
                </CardDescription>
              </div>
              <Button onClick={() => openTagDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                新增標籤
              </Button>
            </CardHeader>
            <CardContent>
              {adminTags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  尚無標籤，點擊上方按鈕新增
                </div>
              ) : (
                <div className="space-y-2">
                  {adminTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge>{tag.name}</Badge>
                        </div>
                        {tag.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {tag.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTagDialog(tag)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTag(tag)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Types */}
        <TabsContent value="types" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>專案類型</CardTitle>
                <CardDescription>
                  管理專案類型與對應的撥款額度範圍
                </CardDescription>
              </div>
              <Button onClick={() => openTypeDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                新增類型
              </Button>
            </CardHeader>
            <CardContent>
              {projectTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  尚無類型，點擊上方按鈕新增
                </div>
              ) : (
                <div className="space-y-2">
                  {projectTypes.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{type.name}</p>
                        <p className="text-sm text-muted-foreground">
                          額度範圍：${type.budgetMin.toLocaleString()} ~ $
                          {type.budgetMax.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTypeDialog(type)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteType(type)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Templates */}
        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>流程範本</CardTitle>
                <CardDescription>
                  建立計畫時可套用的流程範本
                </CardDescription>
              </div>
              <Button onClick={() => openTemplateDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                新增範本
              </Button>
            </CardHeader>
            <CardContent>
              {workflowTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  尚無範本，點擊上方按鈕新增
                </div>
              ) : (
                <div className="space-y-3">
                  {workflowTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {template.steps.map((step, i) => (
                          <Badge
                            key={step.id}
                            variant={step.type === "approval" ? "warning" : "secondary"}
                          >
                            {i + 1}. {step.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Admin Tag Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "編輯標籤" : "新增標籤"}</DialogTitle>
            <DialogDescription>設定管理員標籤資訊</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>標籤名稱 *</Label>
              <Input
                value={tagForm.name}
                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                placeholder="例如：財務組長"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={tagForm.description}
                onChange={(e) =>
                  setTagForm({ ...tagForm, description: e.target.value })
                }
                placeholder="選填"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTagDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTag} disabled={isSavingTag}>
              {isSavingTag ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Type Dialog */}
      <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "編輯類型" : "新增類型"}</DialogTitle>
            <DialogDescription>設定專案類型與額度範圍</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>類型名稱 *</Label>
              <Input
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                placeholder="例如：急難救助"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>最低額度</Label>
                <Input
                  type="number"
                  value={typeForm.budgetMin}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      budgetMin: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>最高額度</Label>
                <Input
                  type="number"
                  value={typeForm.budgetMax}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      budgetMax: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTypeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveType} disabled={isSavingType}>
              {isSavingType ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "編輯範本" : "新增範本"}
            </DialogTitle>
            <DialogDescription>設定流程範本</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>範本名稱 *</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, name: e.target.value })
                  }
                  placeholder="例如：標準審核流程"
                />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Input
                  value={templateForm.description}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="選填"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>流程步驟</Label>
                <Button variant="outline" size="sm" onClick={addTemplateStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增步驟
                </Button>
              </div>

              <div className="space-y-2">
                {templateSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="text-sm font-medium w-8">{index + 1}.</span>
                    <Input
                      className="flex-1"
                      value={step.name}
                      onChange={(e) =>
                        updateTemplateStep(index, { name: e.target.value })
                      }
                      placeholder="步驟名稱"
                    />
                    <Select
                      value={step.type}
                      onValueChange={(v) =>
                        updateTemplateStep(index, {
                          type: v as "status" | "approval",
                        })
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status">狀態</SelectItem>
                        <SelectItem value="approval">審批</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTemplateStep(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTemplateDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              {isSavingTemplate ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
