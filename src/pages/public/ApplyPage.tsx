import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { userService } from "@/services"
import { CheckCircle } from "lucide-react"

const applySchema = z.object({
  name: z.string().min(2, "姓名至少需要 2 個字"),
  email: z.string().email("請輸入有效的 Email"),
  phone: z.string().regex(/^09\d{8}$/, "請輸入有效的手機號碼（09xxxxxxxx）"),
  birthday: z.string().min(1, "請選擇生日"),
  occupation: z.string().min(1, "請輸入職業"),
  experience: z.string().min(10, "請描述您的相關經驗（至少 10 字）"),
  lineId: z.string().min(1, "請輸入 LINE ID"),
})

type ApplyFormData = z.infer<typeof applySchema>

export function ApplyPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplyFormData>({
    resolver: zodResolver(applySchema),
  })

  const onSubmit = async (data: ApplyFormData) => {
    setIsSubmitting(true)

    try {
      // Check if email already exists
      const existing = await userService.getApplicationByEmail(data.email)
      if (existing) {
        alert("此 Email 已有申請紀錄，請使用其他 Email 或查詢申請進度。")
        setIsSubmitting(false)
        return
      }

      await userService.createApplication(data)
      setSubmittedEmail(data.email)
      setIsSuccess(true)
    } catch (error) {
      console.error("Failed to submit application:", error)
      alert("提交失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
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
              <h2 className="text-2xl font-bold">申請已送出</h2>
              <p className="text-muted-foreground">
                感謝您的申請！我們會盡快審核您的資料。
                <br />
                審核結果將透過 Email 通知您。
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">申請 Email</p>
                <p className="font-medium">{submittedEmail}</p>
              </div>
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
          <CardTitle className="text-2xl">志工申請</CardTitle>
          <CardDescription>
            填寫以下表單申請成為志工。審核通過後，您將收到 Email 通知並取得登入帳號。
            <br />
            你的每一份付出，都能為需要幫助的人帶來溫暖。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="font-medium mb-4">基本資料</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    姓名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="王小明"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthday">
                    生日 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="birthday"
                    type="date"
                    {...register("birthday")}
                  />
                  {errors.birthday && (
                    <p className="text-sm text-destructive">{errors.birthday.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    手機號碼 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    placeholder="0912345678"
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    此號碼將作為您的預設登入密碼
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupation">
                    職業 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="occupation"
                    placeholder="學生 / 工程師 / 教師..."
                    {...register("occupation")}
                  />
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
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    此 Email 將作為您的登入帳號
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lineId">
                    LINE ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lineId"
                    placeholder="your_line_id"
                    {...register("lineId")}
                  />
                  {errors.lineId && (
                    <p className="text-sm text-destructive">{errors.lineId.message}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Experience */}
            <div className="space-y-2">
              <Label htmlFor="experience">
                相關經驗 <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="experience"
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                placeholder="請描述您的志工經驗、專長、或為何想參與志工活動..."
                {...register("experience")}
              />
              {errors.experience && (
                <p className="text-sm text-destructive">{errors.experience.message}</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "提交中..." : "提交申請"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/">取消</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              已經申請過了？
              <Link to="/apply/status" className="text-primary hover:underline ml-1">
                查詢申請進度
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
