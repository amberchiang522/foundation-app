import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { settingsService } from "@/services"
import type { User, UserRole, AdminTag } from "@/types"
import { Shield, Edit, Users, UserCheck, Tags, Plus, Pencil, Trash2 } from "lucide-react"

const roleLabels: Record<UserRole, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  volunteer: { label: "志工", variant: "secondary" },
  staff: { label: "內部人員", variant: "secondary" },
  admin: { label: "管理員", variant: "default" },
  super_admin: { label: "超級管理員", variant: "destructive" },
}

// Role priority for sorting (higher = more priority)
const rolePriority: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  staff: 2,
  volunteer: 1,
}

export function AccountManagePage() {
  const { user: currentUser, isSuperAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [adminTags, setAdminTags] = useState<AdminTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>("volunteer")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Admin Tag Dialog
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null)
  const [tagForm, setTagForm] = useState({ name: "", description: "" })
  const [isSavingTag, setIsSavingTag] = useState(false)

  // Redirect if not super admin
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">權限不足</h2>
          <p className="text-muted-foreground">此頁面僅限超級管理員存取</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load all users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (profilesError) {
        console.error("Error loading profiles:", profilesError)
      } else {
        // Load admin tags for each user
        const usersWithTags = await Promise.all(
          (profilesData || []).map(async (profile) => {
            const { data: tagsData } = await supabase
              .from("user_admin_tags")
              .select("tag_id")
              .eq("user_id", profile.id)

            return {
              id: profile.id,
              volunteerNumber: profile.volunteer_number || "",
              type: profile.type,
              role: profile.role as UserRole,
              adminTags: tagsData?.map((t) => t.tag_id as string) || [],
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              birthday: profile.birthday,
              occupation: profile.occupation || "",
              experience: profile.experience || "",
              lineId: profile.line_id || "",
              avatar: profile.avatar,
              status: profile.status,
              createdAt: profile.created_at,
              updatedAt: profile.updated_at,
            } as User
          })
        )
        setUsers(usersWithTags)
      }

      // Load admin tags
      const tagsData = await settingsService.getAdminTags()
      setAdminTags(tagsData)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter users by type
  const staffUsers = users
    .filter((u) => u.role === "super_admin" || u.role === "admin" || u.role === "staff")
    .sort((a, b) => rolePriority[b.role] - rolePriority[a.role])

  const volunteerUsers = users.filter((u) => u.role === "volunteer")

  // State for editing user name
  const [editingUserName, setEditingUserName] = useState("")

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditingUserName(user.name)
    setSelectedRole(user.role)
    setSelectedTags(user.adminTags || [])
  }

  const handleSaveUser = async () => {
    if (!editingUser) return

    if (!editingUserName.trim()) {
      alert("請填寫名稱")
      return
    }

    setIsSaving(true)
    try {
      // Update name and role
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ name: editingUserName.trim(), role: selectedRole })
        .eq("id", editingUser.id)

      if (updateError) {
        console.error("Error updating user:", updateError)
        alert("更新失敗")
        return
      }

      // Update admin tags
      // First, delete existing tags
      await supabase
        .from("user_admin_tags")
        .delete()
        .eq("user_id", editingUser.id)

      // Then, insert new tags
      if (selectedTags.length > 0) {
        const tagsToInsert = selectedTags.map((tagId) => ({
          user_id: editingUser.id,
          tag_id: tagId,
        }))

        const { error: tagsError } = await supabase
          .from("user_admin_tags")
          .insert(tagsToInsert)

        if (tagsError) {
          console.error("Error updating tags:", tagsError)
          alert("更新標籤失敗")
          return
        }
      }

      // Reload data
      await loadData()
      setEditingUser(null)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    )
  }

  const getTagNames = (tagIds: string[]) => {
    return tagIds
      .map((id) => adminTags.find((t) => t.id === id)?.name)
      .filter(Boolean)
      .join(", ")
  }

  // === Admin Tags Management ===
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

  // Render user table (desktop)
  const renderUserTable = (userList: User[], showVolunteerNumber = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名稱</TableHead>
          {showVolunteerNumber && <TableHead>志工編號</TableHead>}
          <TableHead>Email</TableHead>
          <TableHead>角色</TableHead>
          {!showVolunteerNumber && <TableHead>管理員標籤</TableHead>}
          <TableHead>狀態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {userList.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            {showVolunteerNumber && (
              <TableCell>{user.volunteerNumber || "-"}</TableCell>
            )}
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <Badge variant={roleLabels[user.role].variant}>
                {roleLabels[user.role].label}
              </Badge>
            </TableCell>
            {!showVolunteerNumber && (
              <TableCell>
                {user.adminTags && user.adminTags.length > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {getTagNames(user.adminTags)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
            )}
            <TableCell>
              <Badge
                variant={user.status === "active" ? "default" : "destructive"}
              >
                {user.status === "active" ? "啟用" : "停權"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditUser(user)}
                disabled={user.id === currentUser?.id}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  // Render user cards (mobile)
  const renderUserCards = (userList: User[], showVolunteerNumber = false) => (
    <div className="space-y-4">
      {userList.map((user) => (
        <Card key={user.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{user.name}</span>
                  <Badge variant={roleLabels[user.role].variant} className="text-xs">
                    {roleLabels[user.role].label}
                  </Badge>
                  <Badge
                    variant={user.status === "active" ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {user.status === "active" ? "啟用" : "停權"}
                  </Badge>
                </div>
                {showVolunteerNumber && user.volunteerNumber && (
                  <p className="text-sm text-muted-foreground">
                    編號: {user.volunteerNumber}
                  </p>
                )}
                <p className="text-sm text-muted-foreground truncate">
                  {user.email}
                </p>
                {!showVolunteerNumber && user.adminTags && user.adminTags.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    標籤: {getTagNames(user.adminTags)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditUser(user)}
                disabled={user.id === currentUser?.id}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            帳號管理
          </h1>
          <p className="text-muted-foreground">管理所有使用者帳號與權限</p>
        </div>
      </div>

      <Tabs defaultValue="staff">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>內部人員</span>
            <Badge variant="secondary" className="ml-1">{staffUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="volunteers" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span>志工</span>
            <Badge variant="secondary" className="ml-1">{volunteerUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            <span>管理員標籤</span>
          </TabsTrigger>
        </TabsList>

        {/* Staff Tab */}
        <TabsContent value="staff" className="mt-6">
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>內部人員 ({staffUsers.length})</CardTitle>
              <CardDescription>超級管理員、管理員、內部人員</CardDescription>
            </CardHeader>
            <CardContent>
              {staffUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  尚無內部人員
                </div>
              ) : (
                renderUserTable(staffUsers, false)
              )}
            </CardContent>
          </Card>

          <div className="md:hidden">
            <div className="mb-4">
              <h2 className="font-semibold">內部人員 ({staffUsers.length})</h2>
              <p className="text-sm text-muted-foreground">超級管理員、管理員、內部人員</p>
            </div>
            {staffUsers.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  尚無內部人員
                </CardContent>
              </Card>
            ) : (
              renderUserCards(staffUsers, false)
            )}
          </div>
        </TabsContent>

        {/* Volunteers Tab */}
        <TabsContent value="volunteers" className="mt-6">
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>志工 ({volunteerUsers.length})</CardTitle>
              <CardDescription>所有志工帳號</CardDescription>
            </CardHeader>
            <CardContent>
              {volunteerUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  尚無志工
                </div>
              ) : (
                renderUserTable(volunteerUsers, true)
              )}
            </CardContent>
          </Card>

          <div className="md:hidden">
            <div className="mb-4">
              <h2 className="font-semibold">志工 ({volunteerUsers.length})</h2>
              <p className="text-sm text-muted-foreground">所有志工帳號</p>
            </div>
            {volunteerUsers.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  尚無志工
                </CardContent>
              </Card>
            ) : (
              renderUserCards(volunteerUsers, true)
            )}
          </div>
        </TabsContent>

        {/* Admin Tags Tab */}
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
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯帳號</DialogTitle>
            <DialogDescription>
              修改帳號名稱、角色與管理員標籤
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名稱</Label>
              <Input
                value={editingUserName}
                onChange={(e) => setEditingUserName(e.target.value)}
                placeholder="輸入名稱"
              />
            </div>

            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">志工</SelectItem>
                  <SelectItem value="staff">內部人員</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                  <SelectItem value="super_admin">超級管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(selectedRole === "staff" || selectedRole === "admin" || selectedRole === "super_admin") && (
              <div className="space-y-2">
                <Label>管理員標籤</Label>
                <div className="space-y-2 border rounded-md p-3">
                  {adminTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">尚無標籤，請先在「管理員標籤」分頁新增</p>
                  ) : (
                    adminTags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={tag.id}
                          checked={selectedTags.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <label
                          htmlFor={tag.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {tag.name}
                          {tag.description && (
                            <span className="text-muted-foreground ml-2">
                              ({tag.description})
                            </span>
                          )}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              取消
            </Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
