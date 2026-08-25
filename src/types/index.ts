// Image types for upload
export interface ImageData {
  id: string
  originalUrl: string
  thumbnailUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  order: number
}

// User / Volunteer types
export type VolunteerType = 'youth' | 'social'
export type UserRole = 'volunteer' | 'staff' | 'admin' | 'super_admin'
export type UserStatus = 'active' | 'suspended'

export interface User {
  id: string
  volunteerNumber: string      // Y-001 or S-001
  type: VolunteerType
  role: UserRole
  adminTags?: string[]         // Admin tags (only for admin)

  // Basic info
  name: string
  email: string
  phone: string
  birthday: string             // ISO date string
  occupation: string
  experience: string
  lineId: string

  // Avatar
  avatar?: ImageData

  // Status
  status: UserStatus
  createdAt: string
  updatedAt: string
}

// Volunteer Application types
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision'

export interface VolunteerApplication {
  id: string
  token: string

  // Form data
  name: string
  email: string
  phone: string
  birthday: string
  occupation: string
  experience: string
  lineId: string

  // Review status
  status: ApplicationStatus
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string

  createdAt: string
  updatedAt: string
}

// Workflow types
export type WorkflowStepType = 'status' | 'approval' | 'establishment' | 'tracking'
export type WorkflowStepStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'not_established' | 'completed' | 'archived'
export type AssigneeType = 'tag' | 'person'
export type ApproverType = 'tag' | 'person'  // Keep for backwards compatibility
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'voided'

// Sub-task for workflow steps
export interface SubTask {
  id: string
  name: string
  completed: boolean
  requireAttachment?: boolean
  attachments?: ImageData[]
  note?: string  // Description/note for the sub-task
  completedBy?: string
  completedAt?: string
}

export interface WorkflowStep {
  id: string
  name: string
  type: WorkflowStepType

  // Assignee settings (who executes/fills the step)
  assigneeType?: AssigneeType
  assigneeTagId?: string
  assigneeUserIds?: string[]  // Multiple assignees allowed

  // Verifier settings (who approves the execution)
  verifierType?: AssigneeType
  verifierTagId?: string
  verifierUserIds?: string[]  // Multiple verifiers allowed

  // Legacy approval settings (for backwards compatibility)
  approverType?: ApproverType
  approverTagId?: string
  approverUserIds?: string[]  // Multiple approvers allowed

  // Sub-tasks (must all be completed before step can advance)
  subTasks?: SubTask[]

  // Attachment requirement (for approval steps)
  requireAttachment?: boolean
  attachments?: ImageData[]

  // Execution status (used in projects)
  status?: WorkflowStepStatus
  currentRound?: number  // Current execution round
  approvedBy?: string
  approvedAt?: string
  note?: string
}

// Workflow Step Execution (individual submission record)
export interface WorkflowStepExecution {
  id: string
  projectId: string
  stepId: string
  round: number  // Execution round (increments on rejection)

  // Assignee configuration at time of execution
  assigneeType?: AssigneeType
  assigneeTagId?: string
  assigneeUserId?: string

  // Verifier configuration at time of execution
  verifierType?: AssigneeType
  verifierTagId?: string
  verifierUserId?: string

  // Execution data
  executedBy?: string
  executedAt?: string
  content?: string
  attachments: ImageData[]

  // Verification result
  verificationStatus: VerificationStatus
  verifiedBy?: string
  verifiedAt?: string
  rejectReason?: string

  createdAt: string
  updatedAt: string
}

// Workflow Step Execution with user details
export interface WorkflowStepExecutionWithDetails extends WorkflowStepExecution {
  executor?: {
    id: string
    name: string
  }
  verifier?: {
    id: string
    name: string
  }
  assigneeTag?: {
    id: string
    name: string
  }
  verifierTag?: {
    id: string
    name: string
  }
}

// Plan types
export type PlanStatus = 'active' | 'archived'

// PDF 資料結構（支援靜態檔案和上傳檔案）
export interface PDFData {
  id: string
  url: string
  fileName: string
  fileSize?: number      // 可選，靜態檔案不需要
  uploadedAt?: string    // 可選，靜態檔案不需要
}

export interface Plan {
  id: string
  name: string
  description: string
  type: string

  workflow: WorkflowStep[]

  status: PlanStatus
  createdBy: string
  createdAt: string
  updatedAt: string

  // 公開設定
  isPublic?: boolean
  publicOrder?: number
  coverImage?: ImageData
  cardDescription?: string      // 卡片簡介（首頁顯示）
  publicDescription?: string    // 詳細介紹文字
  introPdf?: PDFData
  downloadPdfs?: PDFData[]

  // Computed fields
  organizationCount?: number
}

// 公開計畫資訊（獨立表，安全公開）
export interface PlanPublicInfo {
  id: string
  planId: string
  name: string
  cardDescription?: string
  publicDescription?: string
  coverImage?: ImageData
  introPdf?: PDFData
  downloadPdfs?: PDFData[]
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Project types
export type ProjectStatus = 'active' | 'completed' | 'archived' | 'not_established'

export interface Project {
  id: string
  planId: string
  organizationId?: string  // Link to organization
  name: string
  description: string

  projectType: string
  budgetAmount: number

  // Images
  resultImages?: ImageData[]
  receiptImages?: ImageData[]

  workflow: WorkflowStep[]
  currentStep: number

  status: ProjectStatus
  createdBy: string
  createdAt: string
  updatedAt: string

  // Tracking settings (for completed projects)
  trackingEnabled?: boolean
  trackingIntervalDays?: number  // e.g., 30, 60, 90
  nextTrackingDate?: string      // ISO date string
  trackingNotificationDismissed?: boolean
}

// Project with related data
export interface ProjectWithDetails extends Project {
  plan?: {
    id: string
    name: string
  }
  organization?: {
    id: string
    name: string
  }
  executionCount?: number  // Number of pending executions
}

// Project Type settings
export interface ProjectType {
  id: string
  name: string
  budgetMin: number
  budgetMax: number
  defaultWorkflow?: WorkflowStep[]
}

// Activity types
export type ActivityStatus = 'upcoming' | 'ongoing' | 'completed' | 'archived'
export type RegistrationMode = 'direct' | 'approval'

export interface Activity {
  id: string
  projectId?: string
  planId?: string  // 關聯計畫

  name: string
  description: string
  date: string
  location: string
  locationUrl?: string  // Google Maps link
  type: string

  // Images
  coverImage?: ImageData
  contentImages?: ImageData[]

  capacity: number
  registrationMode: RegistrationMode

  status: ActivityStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Activity Registration types
export type RegistrationStatus = 'confirmed' | 'pending' | 'waitlist' | 'cancelled'

export interface ActivityRegistration {
  id: string
  activityId: string
  userId: string

  status: RegistrationStatus
  waitlistPosition?: number

  reviewedBy?: string
  reviewedAt?: string

  attended?: boolean
  serviceHours?: number

  createdAt: string
  updatedAt: string
}

// Admin Tag
export interface AdminTag {
  id: string
  name: string
  description?: string
  createdAt: string
}

// System Settings
export interface SystemSettings {
  youthAgeThreshold: number   // Default: 30
}

// Workflow Template
export interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  steps: WorkflowStep[]
  createdAt: string
}

// =====================================================
// Organization Management Types
// =====================================================

// 機構類型
export type OrganizationCategory = 'orphanage' | 'association' | 'school' | 'hospital' | 'other'

// 訪視狀態
export type VisitStatus = 'pending' | 'completed' | 'cancelled'

// 機構類型標籤對照
export const OrganizationCategoryLabels: Record<OrganizationCategory, string> = {
  orphanage: '育幼院',
  association: '協會',
  school: '學校',
  hospital: '醫療機構',
  other: '其他',
}

// 訪視狀態標籤對照
export const VisitStatusLabels: Record<VisitStatus, string> = {
  pending: '待訪視',
  completed: '已完成',
  cancelled: '已取消',
}

// 機構
export interface Organization {
  id: string
  name: string
  category: OrganizationCategory
  contactPerson?: string
  address?: string
  phone?: string
  website?: string
  lineId?: string
  notes?: string
  planIds?: string[]  // Multiple plans (many-to-many)
  createdBy: string
  createdAt: string
  updatedAt: string
}

// 機構（含關聯資料）
export interface OrganizationWithDetails extends Organization {
  plans?: {
    id: string
    name: string
  }[]
  visitCount?: number
  lastVisitDate?: string
  upcomingVisitCount?: number
}

// 訪視紀錄
export interface VisitRecord {
  id: string
  organizationId: string
  visitDate: string
  visitorIds: string[]
  purpose?: string
  content?: string
  orgRequests?: string
  foundationRequests?: string
  nextSteps?: string
  progressUpdate?: string
  attachments?: ImageData[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

// 訪視紀錄（含關聯資料）
export interface VisitRecordWithDetails extends VisitRecord {
  visitors?: Array<{
    id: string
    name: string
  }>
  organization?: {
    id: string
    name: string
  }
}

// 待訪視日程
export interface UpcomingVisit {
  id: string
  organizationId: string
  plannedDate: string
  plannedTime?: string
  purpose?: string
  assignedUserIds: string[]
  status: VisitStatus
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

// 待訪視日程（含關聯資料）
export interface UpcomingVisitWithDetails extends UpcomingVisit {
  organization?: {
    id: string
    name: string
  }
  assignedUsers?: Array<{
    id: string
    name: string
  }>
}

// =====================================================
// 活動回顧 Types
// =====================================================

export interface EventReview {
  id: string
  planId: string
  title: string
  content: string
  eventDate?: string
  images: ImageData[]
  isPublished: boolean
  publishedAt?: string
  displayOrder: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface EventReviewWithDetails extends EventReview {
  plan?: {
    id: string
    name: string
  }
  author?: {
    id: string
    name: string
  }
}

// =====================================================
// 討論區 Types
// =====================================================

export type ForumPostStatus = 'pending' | 'active' | 'closed' | 'archived'

export interface ForumPost {
  id: string
  planId?: string
  title: string
  content: string
  images: ImageData[]
  status: ForumPostStatus
  isPinned: boolean
  viewCount: number
  replyCount: number
  lastReplyAt?: string
  lastReplyBy?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ForumPostWithDetails extends ForumPost {
  plan?: {
    id: string
    name: string
  }
  author?: {
    id: string
    name: string
    avatar?: ImageData
    createdAt?: string  // 志工加入時間
  }
  lastReplyAuthor?: {
    id: string
    name: string
  }
}

export interface ForumReply {
  id: string
  postId: string
  parentId?: string
  content: string
  images: ImageData[]
  isDeleted: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ForumReplyWithDetails extends ForumReply {
  author?: {
    id: string
    name: string
    avatar?: ImageData
  }
  replies?: ForumReplyWithDetails[]
}
