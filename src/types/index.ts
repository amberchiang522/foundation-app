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
export type UserRole = 'volunteer' | 'admin'
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
export type WorkflowStepType = 'status' | 'approval' | 'establishment'
export type WorkflowStepStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'not_established'
export type ApproverType = 'tag' | 'person'

// Sub-task for workflow steps
export interface SubTask {
  id: string
  name: string
  completed: boolean
  requireAttachment?: boolean
  attachments?: ImageData[]
  completedBy?: string
  completedAt?: string
}

export interface WorkflowStep {
  id: string
  name: string
  type: WorkflowStepType

  // Approval settings (for type='approval')
  approverType?: ApproverType
  approverTagId?: string
  approverUserId?: string

  // Sub-tasks (must all be completed before step can advance)
  subTasks?: SubTask[]

  // Attachment requirement (for approval steps)
  requireAttachment?: boolean
  attachments?: ImageData[]

  // Execution status (used in projects)
  status?: WorkflowStepStatus
  approvedBy?: string
  approvedAt?: string
  note?: string
}

// Plan types
export type PlanStatus = 'active' | 'archived'

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
}

// Project types
export type ProjectStatus = 'active' | 'completed' | 'archived' | 'not_established'

export interface Project {
  id: string
  planId: string
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

  name: string
  description: string
  date: string
  location: string
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
