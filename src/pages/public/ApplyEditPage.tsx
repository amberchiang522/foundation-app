import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { userService } from "@/services"
import type { VolunteerApplication } from "@/types"
import { CheckCircle, AlertCircle } from "lucide-react"

const editSchema = z.object({
  name: z.string().min(2, "姓名至少需要 2 個字"),
  email: z.string().email("請輸入有效的 Email"),
  phone: z.string().regex(/^09\d{8}$/, "請輸入有效的手機號碼"),
  birthday: z.string().min(1, "請選擇生日"),
  occupation: z.string().min(1, "請輸入職業"),
  experience: z.string().min(10, "請描述您的相關經驗（至少 10 字）"),
  lineId: z.string().min(1, "請輸入 LINE ID"),
})

type EditFormData = z.infer<typeof editSchema>

export function ApplyEditPage() {
  const { token } = useParams<{ token: string }>()

  const [application, setApplication] = useState<VolunteerApplication | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    const loadApplication = async () => {
      if (!token) return

      try {
        const data = await userService.getApplicationByToken(token)
        if (data) {
          setApplication(data)
          reset({
            name: data.name,
            email: data.email,
            phone: data.phone,
            birthday: data.birthday,
            occupation: data.occupation,
            experience: data.experience,
            lineId: data.lineId,
          })
        }
      } catch (error) {
        console.error("Failed to load application:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadApplication()
  }, [token, reset])

  const onSubmit = async (data: EditFormData) => {
    if (!application) return

    setIsSubmitting(true)

    try {
      await userService.updateApplication(application.id, {
        ...data,
        status: "pending", // Reset to pending after revision
        reviewNote: undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
      })
      setIsSuccess(true)
    } catch (error) {
      console.error("Failed to update application:", error)
      alert("提交失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">載入中...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-bold">連結無效或已過期</h2>
              <p className="text-muted-foreground">
                找不到此補件連結對應的申請紀錄
              </p>
              <Button asChild>
                <Link to="/apply/status">查詢申請進度</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (application.status !== "needs_revision") {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-bold">此申請不需要補件</h2>
              <p className="text-muted-foreground">
                您的申請狀態為「{application.status === "pending" ? "審核中" :
                  application.status === "approved" ? "已通過" : "未通過"}」
              </p>
              <Button asChild>
                <Link to="/apply/status">查看申請進度</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">已重新送審</h2>
              <p className="text-muted-foreground">
                您的修改已提交，我們會盡快重新審核。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/apply/status">查詢申請進度</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link to="/">返回首頁</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">補件修改</CardTitle>
          <CardDescription>
            請根據審核意見修改您的資料後重新送審
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Review Note */}
          {application.reviewNote && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 mb-1">補件說明</p>
              <p className="text-sm text-yellow-700">{application.reviewNote}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="font-medium mb-4">基本資料</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名 *</Label>
                  <Input id="name" {...register("name")} />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthday">生日 *</Label>
                  <Input id="birthday" type="date" {...register("birthday")} />
                  {errors.birthday && (
                    <p className="text-sm text-destructive">{errors.birthday.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">手機號碼 *</Label>
                  <Input id="phone" {...register("phone")} />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupation">職業 *</Label>
                  <Input id="occupation" {...register("occupation")} />
                  {errors.occupation && (
                    <p className="text-sm text-destructive">{errors.occupation.message}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact Info */}
            <div>
              <h3 className="font-medium mb-4">聯絡方式</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lineId">LINE ID *</Label>
                  <Input id="lineId" {...register("lineId")} />
                  {errors.lineId && (
                    <p className="text-sm text-destructive">{errors.lineId.message}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Experience */}
            <div className="space-y-2">
              <Label htmlFor="experience">相關經驗 *</Label>
              <textarea
                id="experience"
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                {...register("experience")}
              />
              {errors.experience && (
                <p className="text-sm text-destructive">{errors.experience.message}</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "提交中..." : "重新送審"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/apply/status">取消</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
