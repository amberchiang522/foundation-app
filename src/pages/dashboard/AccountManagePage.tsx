import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { User, UserRole, AdminTag } from "@/types"
import { Shield, Edit, Users } from "lucide-react"

const roleLabels: Record<UserRole, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  volunteer: { label: "志工", variant: "secondary" },
  admin: { label: "管理員", variant: "default" },
  super_admin: { label: "超級管理員", variant: "destructive" },
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
      const { data: tagsData, error: tagsError } = await supabase
        .from("admin_tags")
        .select("*")
        .order("name")

      if (tagsError) {
        console.error("Error loading admin tags:", tagsError)
      } else {
        setAdminTags(
          (tagsData || []).map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            createdAt: t.created_at,
          }))
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setSelectedRole(user.role)
    setSelectedTags(user.adminTags || [])
  }

  const handleSaveUser = async () => {
    if (!editingUser) return

    setIsSaving(true)
    try {
      // Update role
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("id", editingUser.id)

      if (roleError) {
        console.error("Error updating role:", roleError)
        alert("更新角色失敗")
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

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>所有帳號 ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>管理員標籤</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleLabels[user.role].variant}>
                      {roleLabels[user.role].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.adminTags && user.adminTags.length > 0 ? (
                      <span className="text-sm text-muted-foreground">
                        {getTagNames(user.adminTags)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
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
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        <div className="text-sm text-muted-foreground">
          所有帳號 ({users.length})
        </div>
        {users.map((user) => (
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
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                  {user.adminTags && user.adminTags.length > 0 && (
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

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯帳號權限</DialogTitle>
            <DialogDescription>
              修改 {editingUser?.name} 的角色與管理員標籤
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                  <SelectItem value="admin">管理員</SelectItem>
                  <SelectItem value="super_admin">超級管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(selectedRole === "admin" || selectedRole === "super_admin") && (
              <div className="space-y-2">
                <Label>管理員標籤</Label>
                <div className="space-y-2 border rounded-md p-3">
                  {adminTags.map((tag) => (
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
                  ))}
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
    </div>
  )
}
