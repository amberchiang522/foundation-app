import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { userService } from "@/services"
import type { VolunteerApplication } from "@/types"
import { Search, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"

const searchSchema = z.object({
  email: z.string().email("請輸入有效的 Email"),
})

type SearchFormData = z.infer<typeof searchSchema>

const statusConfig: Record<VolunteerApplication["status"], {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
  icon: typeof CheckCircle
  description: string
}> = {
  pending: {
    label: "審核中",
    variant: "secondary",
    icon: Clock,
    description: "您的申請正在審核中，請耐心等候。",
  },
  approved: {
    label: "已通過",
    variant: "success",
    icon: CheckCircle,
    description: "恭喜！您的申請已通過。請使用您的 Email 與手機號碼登入系統。",
  },
  rejected: {
    label: "未通過",
    variant: "destructive",
    icon: XCircle,
    description: "很抱歉，您的申請未通過審核。",
  },
  needs_revision: {
    label: "需補件",
    variant: "warning",
    icon: AlertCircle,
    description: "請根據審核意見補充或修改資料後重新送審。",
  },
}

export function ApplyStatusPage() {
  const [application, setApplication] = useState<VolunteerApplication | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
  })

  const onSubmit = async (data: SearchFormData) => {
    setIsSearching(true)
    setSearched(false)

    try {
      const result = await userService.getApplicationByEmail(data.email)
      setApplication(result)
      setSearched(true)
    } catch (error) {
      console.error("Failed to search:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const status = application ? statusConfig[application.status] : null
  const StatusIcon = status?.icon || Clock

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>申請進度查詢</CardTitle>
          <CardDescription>
            輸入您申請時使用的 Email 來查詢審核進度
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...register("email")}
                />
                <Button type="submit" disabled={isSearching}>
                  {isSearching ? (
                    "查詢中..."
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-1" />
                      查詢
                    </>
                  )}
                </Button>
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search Result */}
      {searched && (
        <Card>
          <CardContent className="pt-6">
            {application && status ? (
              <div className="space-y-6">
                {/* Status Header */}
                <div className="text-center space-y-3">
                  <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                    application.status === "approved" ? "bg-green-100" :
                    application.status === "rejected" ? "bg-red-100" :
                    application.status === "needs_revision" ? "bg-yellow-100" :
                    "bg-muted"
                  }`}>
                    <StatusIcon className={`h-8 w-8 ${
                      application.status === "approved" ? "text-green-600" :
                      application.status === "rejected" ? "text-red-600" :
                      application.status === "needs_revision" ? "text-yellow-600" :
                      "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="text-muted-foreground">{status.description}</p>
                </div>

                <Separator />

                {/* Application Info */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">申請人</span>
                    <span className="font-medium">{application.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">申請時間</span>
                    <span>{new Date(application.createdAt).toLocaleDateString("zh-TW")}</span>
                  </div>
                  {application.reviewedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">審核時間</span>
                      <span>{new Date(application.reviewedAt).toLocaleDateString("zh-TW")}</span>
                    </div>
                  )}
                </div>

                {/* Review Note */}
                {application.reviewNote && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {application.status === "needs_revision" ? "補件說明" : "審核備註"}
                      </p>
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        {application.reviewNote}
                      </div>
                    </div>
                  </>
                )}

                {/* Actions */}
                {application.status === "needs_revision" && (
                  <Button asChild className="w-full">
                    <Link to={`/apply/edit/${application.token}`}>
                      修改並重新送審
                    </Link>
                  </Button>
                )}

                {application.status === "approved" && (
                  <Button asChild className="w-full">
                    <Link to="/login">前往登入</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>找不到此 Email 的申請紀錄</p>
                <Button asChild variant="link" className="mt-2">
                  <Link to="/apply">立即申請成為志工</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
