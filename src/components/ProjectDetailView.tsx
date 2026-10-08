import { useState, useEffect, useRef } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type {
  Project,
  OrganizationWithDetails,
} from "@/types"
import {
  XCircle,
  Building2,
  Paperclip,
  Play,
} from "lucide-react"
import { cn } from "@/lib/utils"

// 評估標準定義
export const EVALUATION_CRITERIA = [
  { id: 'economic', name: '經濟狀況', description: '家庭收入、工作狀況程度評估（依經濟困難程度給分，越困難越高分）', maxScore: 25 },
  { id: 'family', name: '家庭支持情形', description: '家庭照顧能力、親屬支援之家庭資源評估（依家庭支持程度給分，越不足分數越高）', maxScore: 20 },
  { id: 'health', name: '健康狀況', description: '評估健康對生活及工作能力之影響（依健康影響程度，影響越大分數越高）', maxScore: 15 },
  { id: 'living', name: '基本生活需求', description: '依基本生活需求及生活困難程度綜合評估（依生活困難程度，越困難越高分）', maxScore: 15 },
  { id: 'resources', name: '外部資源取得情形', description: '是否有政府補助、民間資源及其他協助（外部資源越不足，分數越高）', maxScore: 10 },
  { id: 'documents', name: '文件完整性', description: '申請資料與佐證是否齊全（文件越齊全，分數越高）', maxScore: 5 },
  { id: 'committee', name: '顧問暨評議委員會綜合評估', description: '由委員綜合評估', maxScore: 10 },
]

// 解析評估資料
const parseEvaluationData = (note: string | undefined) => {
  if (!note) return null
  try {
    const data = JSON.parse(note)
    if (data.evaluationScores) return data
    return null
  } catch {
    return null
  }
}

// 計算總分
const calculateTotalScore = (scores: Record<string, { score: number; note: string }>) => {
  return Object.values(scores).reduce((sum, item) => sum + (item.score || 0), 0)
}

interface ProjectDetailViewProps {
  project: Project
  organization?: OrganizationWithDetails | null
  onClose: () => void
}

export function ProjectDetailView({
  project,
  organization,
  onClose,
}: ProjectDetailViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 評估表表單狀態
  const [evalForm, setEvalForm] = useState<{
    visitDate: string
    visitors: string
    visitContent: string
    evaluationScores: Record<string, { score: number; note: string }>
    overallAssessment: string
    purposes: string[]
    subsidyType: 'oneTime' | 'periodic' | ''
    oneTimeMonth: string
    oneTimeAmount: string
    periodStart: string
    periodEnd: string
    frequency: 'monthly' | 'periodic' | ''
    periodicMonths: string
    periodicAmount: string
    committeeMeetingDate: string
  }>({
    visitDate: '',
    visitors: '',
    visitContent: '',
    evaluationScores: {},
    overallAssessment: '',
    purposes: [],
    subsidyType: '',
    oneTimeMonth: '',
    oneTimeAmount: '',
    periodStart: '',
    periodEnd: '',
    frequency: '',
    periodicMonths: '',
    periodicAmount: '',
    committeeMeetingDate: '',
  })

  // 結案表單狀態
  const [closingForm, setClosingForm] = useState<{
    paymentDate: string
  }>({
    paymentDate: '',
  })

  // 載入步驟執行紀錄
  useEffect(() => {
    initializeFormFromProject()
  }, [project.id])

  // 從專案資料初始化表單
  const initializeFormFromProject = () => {
    // 找到評估表步驟
    const evalStep = project.workflow.find(s => s.name.includes("評估"))
    if (evalStep?.note) {
      try {
        const data = JSON.parse(evalStep.note)
        setEvalForm(prev => ({
          ...prev,
          visitDate: data.visitDate || '',
          visitors: data.visitors || '',
          visitContent: data.visitContent || '',
          evaluationScores: data.evaluationScores || {},
          overallAssessment: data.overallAssessment || '',
          purposes: data.purposes || [],
          subsidyType: data.subsidyType || '',
          oneTimeMonth: data.oneTimeMonth || '',
          oneTimeAmount: data.oneTimeAmount || '',
          periodStart: data.periodStart || '',
          periodEnd: data.periodEnd || '',
          frequency: data.frequency || '',
          periodicMonths: data.periodicMonths || '',
          periodicAmount: data.periodicAmount || '',
          committeeMeetingDate: data.committeeMeetingDate || '',
        }))
      } catch {
        // ignore parse error
      }
    }

    // 找到結案步驟
    const closingStep = project.workflow.find(s => s.name.includes("結案"))
    if (closingStep?.note) {
      try {
        const data = JSON.parse(closingStep.note)
        setClosingForm({
          paymentDate: data.paymentDate || '',
        })
      } catch {
        // ignore parse error
      }
    }
  }


  // 計算補助金額顯示
  const getSubsidyAmountDisplay = () => {
    if (evalForm.subsidyType === 'oneTime') {
      return evalForm.oneTimeAmount ? `新台幣 ${parseInt(evalForm.oneTimeAmount).toLocaleString()} 元整` : '-'
    } else if (evalForm.subsidyType === 'periodic') {
      return evalForm.periodicAmount ? `每期 ${parseInt(evalForm.periodicAmount).toLocaleString()} 元` : '-'
    }
    return '-'
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b shrink-0 overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{project.name}</h2>
              {project.projectNumber && (
                <span className="text-sm text-muted-foreground">{project.projectNumber}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge
                variant={
                  project.status === "active" ? "default" :
                  project.status === "completed" ? "success" :
                  project.status === "not_established" ? "destructive" : "secondary"
                }
              >
                {project.status === "active" ? "進行中" :
                 project.status === "completed" ? "已完成" :
                 project.status === "not_established" ? "不成立" : "已封存"}
              </Badge>
              {organization && (
                <Badge variant="outline">
                  <Building2 className="h-3 w-3 mr-1" />
                  {organization.name}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1 items-center">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
        {/* Workflow Progress */}
        <div className="w-full mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">流程進度</h3>
            <span className="text-xs text-muted-foreground">
              建立於 {format(new Date(project.createdAt), "yyyy/MM/dd")}
            </span>
          </div>
          {/* 橫向滾動容器 */}
          <div
            className="overflow-x-auto pb-2 -mx-4 px-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-3 py-4 px-2 bg-muted/30 rounded-lg w-max items-start">
              {project.workflow.map((step, index) => {
                const isCurrentStep = index === project.currentStep &&
                  (step.status === "in_progress" || !step.status || (step.status === "pending" && index === 0))
                const isInactive = (step.status === "pending" || (!step.status && index > project.currentStep)) && !isCurrentStep

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-start gap-3",
                      isInactive && "opacity-40"
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-col items-center transition-all",
                        isCurrentStep ? "min-w-[70px]" : "min-w-[50px]"
                      )}
                    >
                      {/* Step Circle */}
                      <div
                        className={cn(
                          "rounded-full flex items-center justify-center font-medium transition-all",
                          isCurrentStep ? "w-12 h-12 text-base" : "w-9 h-9 text-sm",
                          step.status === "approved"
                            ? "bg-primary text-primary-foreground"
                            : step.status === "in_progress"
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : step.status === "rejected" || step.status === "not_established"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </div>

                      {/* Step Name */}
                      <span className={cn(
                        "mt-2 text-center font-medium leading-tight",
                        isCurrentStep ? "text-sm" : "text-xs"
                      )}>
                        {step.name}
                      </span>
                    </div>

                    {/* Arrow */}
                    {index < project.workflow.length - 1 && (
                      <div className={cn(
                        "flex items-center",
                        isCurrentStep ? "h-16" : "h-10"
                      )}>
                        <Play
                          className={cn(
                            isCurrentStep ? "h-5 w-5" : "h-3 w-3",
                            step.status === "approved"
                              ? "text-primary"
                              : "text-muted-foreground/40"
                          )}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Steps Content */}
        <div className="space-y-6">
          {project.workflow
            .filter(step => step.status === 'approved' || step.status === 'in_progress' || step.status === 'rejected')
            .map((step) => {
              const originalIndex = project.workflow.indexOf(step)
              const isEvalStep = step.name.includes("評估")
              const isCommitteeStep = step.name.includes("評議委員會")
              const isClosingStep = step.name.includes("結案")
              const hasSubTasks = step.subTasks && step.subTasks.length > 0
              const evalData = isEvalStep ? parseEvaluationData(step.note) : null
              // Get committee meeting date from subTask note
              const committeeMeetingDate = isCommitteeStep && step.subTasks?.[0]?.note || ''

              return (
                <div key={step.id} className="border-b pb-6 last:border-b-0">
                    {/* Step Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {originalIndex + 1}.
                        </span>
                        <span className="font-medium">{step.name}</span>
                        {step.approvedAt && (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(step.approvedAt), "yyyy/MM/dd")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Attachments */}
                    {step.attachments && step.attachments.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {step.attachments.map(att => (
                          <a
                            key={att.id}
                            href={att.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.fileName}
                          </a>
                        ))}
                      </div>
                    )}





                    {/* Evaluation Display */}
                    {isEvalStep && evalData && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">訪視日期</span>
                            <p>{evalData.visitDate || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">訪視人員</span>
                            <p>{evalData.visitors || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">訪視內容</span>
                            <p>{evalData.visitContent || '-'}</p>
                          </div>
                        </div>
                        {evalData.evaluationScores && (
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-3 border-b">評估標準</th>
                                  <th className="text-center p-3 border-b">得分</th>
                                  <th className="text-left p-3 border-b">說明</th>
                                </tr>
                              </thead>
                              <tbody>
                                {EVALUATION_CRITERIA.map(criteria => (
                                  <tr key={criteria.id} className="border-b last:border-b-0">
                                    <td className="p-3">{criteria.name}</td>
                                    <td className="p-3 text-center">
                                      {evalData.evaluationScores[criteria.id]?.score || 0}/{criteria.maxScore}
                                    </td>
                                    <td className="p-3 text-muted-foreground">
                                      {evalData.evaluationScores[criteria.id]?.note || '-'}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-muted/30">
                                  <td className="p-3 font-medium">共計</td>
                                  <td className="p-3 text-center font-medium">
                                    {calculateTotalScore(evalData.evaluationScores)}/100
                                  </td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                        {/* 綜合評估 */}
                        <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                          <div className="font-medium">綜合評估</div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {evalData.overallAssessment || '-'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">補助用途</span>
                            <p>{evalData.purposes?.join('、') || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">補助金額</span>
                            <p>{getSubsidyAmountDisplay()}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 評議委員會 - 顯示會議日期 */}
                    {isCommitteeStep && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">會議日期：</span>
                          <span className="text-sm font-medium">
                            {committeeMeetingDate || '-'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Sub-tasks - 不顯示評估表和評議委員會的 sub-tasks */}
                    {hasSubTasks && !isEvalStep && !isCommitteeStep && (
                      <div className="space-y-2">
                        {step.subTasks!.map(task => (
                          <div key={task.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={task.completed}
                              disabled={true}
                            />
                            <span className={cn(
                              "text-sm",
                              task.completed && "text-muted-foreground"
                            )}>
                              {task.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Closing Form - Display Only */}
                    {isClosingStep && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">匯款日期：</span>
                          <span className="text-sm font-medium">
                            {closingForm.paymentDate || '-'}
                          </span>
                        </div>
                      </div>
                    )}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
