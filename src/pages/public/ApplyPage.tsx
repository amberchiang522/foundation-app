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
import { Checkbox } from "@/components/ui/checkbox"
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

function TermsContent() {
  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="font-semibold text-base mb-2">鴻勁公益慈善基金會 志工服務條款</h3>
        <p className="text-muted-foreground">
          歡迎申請加入鴻勁公益慈善基金會志工團隊。本條款依據個人資料保護法相關規定，說明本會如何蒐集、處理及利用您的個人資料。
          當您閱讀並同意本服務條款後，即表示您願意以電子文件方式行使同意權，並具有書面同意之效力。若您不同意，請勿繼續填寫申請表單。
        </p>
      </div>

      <div>
        <h4 className="font-semibold mb-2">一、個人資料蒐集聲明</h4>
        <div className="space-y-3 text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">（一）蒐集目的</p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li>志工招募、培訓、管理及活動安排</li>
              <li>聯繫通知及服務時數登錄</li>
              <li>相關公益活動之推廣與執行</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">（二）蒐集項目</p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li>基本資料：姓名、生日、職業</li>
              <li>聯絡資訊：手機號碼、電子郵件、LINE ID</li>
              <li>其他：志工經驗描述</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">（三）利用期間與範圍</p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li>期間：自您申請成為志工起，至您主動申請退出或本會終止服務為止</li>
              <li>範圍：本會及合作之公益單位，用於志工活動聯繫與管理</li>
              <li>方式：電子郵件、電話、LINE 或其他必要之聯絡方式</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">（四）您的權利</p>
            <p className="ml-2 mt-1">
              依據個人資料保護法，您可隨時向本會申請查詢、閱覽、補充、更正、停止蒐集處理利用或刪除您的個人資料。
              如需行使上述權利，請聯繫本會服務人員。
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">二、會員規範</h4>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>請提供真實且完整的個人資料，如有虛偽或冒用他人資料，應自負法律責任。</li>
          <li>個人資料如有變更，請主動登入系統更新，以確保本會能順利與您聯繫。</li>
          <li>請妥善保管您的帳號密碼，勿將帳號借予他人使用，如發現帳號異常請立即通知本會。</li>
          <li>參與志工活動時，請遵守活動規範及相關法令，維護本會及志工團隊之形象。</li>
          <li>本會將依活動需求，將您的聯絡資訊提供予活動承辦單位，以便進行活動聯繫。</li>
        </ol>
      </div>

      <div>
        <h4 className="font-semibold mb-2">三、注意事項</h4>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>未滿十八歲者申請加入志工，應取得法定代理人同意。</li>
          <li>本會將依志願服務法相關規定，為參與活動之志工辦理意外保險。</li>
          <li>因系統維護或不可抗力因素導致服務中斷時，本會不負賠償責任。</li>
          <li>本會保留修改本服務條款之權利，修改後將於網站公告。</li>
        </ol>
      </div>

      <div>
        <h4 className="font-semibold mb-2">四、管轄法院</h4>
        <p className="text-muted-foreground">
          如因本服務條款發生爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。
        </p>
      </div>
    </div>
  )
}

export function ApplyPage() {
  const [hasAgreed, setHasAgreed] = useState(false)
  const [showForm, setShowForm] = useState(false)
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

  // 服務條款同意頁面
  if (!showForm) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">志工申請</CardTitle>
            <CardDescription>
              請先閱讀並同意以下服務條款，才能繼續填寫申請表單。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border p-6 bg-muted/30">
              <TermsContent />
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="agree"
                checked={hasAgreed}
                onCheckedChange={(checked) => setHasAgreed(checked === true)}
              />
              <label
                htmlFor="agree"
                className="text-sm leading-relaxed cursor-pointer"
              >
                我已詳細閱讀並同意上述「鴻勁公益慈善基金會 志工服務條款」，了解本會將依上述方式蒐集、處理及利用我的個人資料。
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                disabled={!hasAgreed}
                onClick={() => setShowForm(true)}
              >
                同意並繼續
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">返回首頁</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              已經申請過了？
              <Link to="/apply/status" className="text-primary hover:underline ml-1">
                查詢申請進度
              </Link>
            </p>
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
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                返回
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
