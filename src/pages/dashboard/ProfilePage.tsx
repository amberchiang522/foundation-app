import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ImageUploader } from "@/components/upload"
import { useAuth } from "@/contexts/AuthContext"
import { userService, type ImageUploadResult } from "@/services"
import type { ImageData } from "@/types"
import { User as UserIcon, Mail, Phone, Calendar, Briefcase, MessageSquare, Camera } from "lucide-react"

const profileSchema = z.object({
  phone: z.string().regex(/^09\d{8}$/, "請輸入有效的手機號碼"),
  occupation: z.string().min(1, "請輸入職業"),
  lineId: z.string().min(1, "請輸入 LINE ID"),
})

type ProfileFormData = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isEditingAvatar, setIsEditingAvatar] = useState(false)
  const [avatar, setAvatar] = useState<ImageUploadResult | null>(
    (user?.avatar as ImageUploadResult) || null
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: user?.phone || "",
      occupation: user?.occupation || "",
      lineId: user?.lineId || "",
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      await userService.updateUser(user.id, data)
      setSaveSuccess(true)
      setIsEditing(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error("Failed to update profile:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    reset({
      phone: user?.phone || "",
      occupation: user?.occupation || "",
      lineId: user?.lineId || "",
    })
    setIsEditing(false)
  }

  const handleAvatarChange = async (newAvatar: ImageUploadResult | null) => {
    if (!user) return

    setAvatar(newAvatar)
    try {
      await userService.updateUser(user.id, {
        avatar: newAvatar as ImageData | undefined,
      })
      refreshUser?.()
      setIsEditingAvatar(false)
    } catch (error) {
      console.error("Failed to update avatar:", error)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">個人資料</h1>
        <p className="text-muted-foreground">查看與管理您的個人資訊</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {/* Avatar */}
              <div className="relative mx-auto w-20 h-20">
                {avatar ? (
                  <img
                    src={avatar.originalUrl}
                    alt={user.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary">
                      {user.name.charAt(0)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingAvatar(!isEditingAvatar)}
                  className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
                >
                  <Camera className="h-3 w-3" />
                </button>
              </div>

              {/* Avatar Upload */}
              {isEditingAvatar && (
                <div className="space-y-2">
                  <ImageUploader
                    type="volunteer-avatar"
                    value={avatar}
                    onChange={handleAvatarChange}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingAvatar(false)}
                  >
                    取消
                  </Button>
                </div>
              )}

              <div>
                <h2 className="text-xl font-semibold">{user.name}</h2>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex justify-center gap-2">
                <Badge variant={user.type === "youth" ? "default" : "secondary"}>
                  {user.type === "youth" ? "青年志工" : "社會志工"}
                </Badge>
                <Badge variant="outline">{user.volunteerNumber}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>基本資料</CardTitle>
                <CardDescription>
                  {isEditing ? "編輯您的個人資訊" : "您的個人資訊"}
                </CardDescription>
              </div>
              {!isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  編輯
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {saveSuccess && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                資料已成功儲存
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">手機號碼</Label>
                    <Input id="phone" {...register("phone")} />
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="occupation">職業</Label>
                    <Input id="occupation" {...register("occupation")} />
                    {errors.occupation && (
                      <p className="text-sm text-destructive">{errors.occupation.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="lineId">LINE ID</Label>
                    <Input id="lineId" {...register("lineId")} />
                    {errors.lineId && (
                      <p className="text-sm text-destructive">{errors.lineId.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "儲存中..." : "儲存變更"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    取消
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">姓名</p>
                      <p className="font-medium">{user.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">手機</p>
                      <p className="font-medium">{user.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">生日</p>
                      <p className="font-medium">
                        {new Date(user.birthday).toLocaleDateString("zh-TW")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">職業</p>
                      <p className="font-medium">{user.occupation}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">LINE ID</p>
                      <p className="font-medium">{user.lineId}</p>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <p className="text-sm text-muted-foreground mb-2">志工經驗</p>
                  <p className="text-sm">{user.experience}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
