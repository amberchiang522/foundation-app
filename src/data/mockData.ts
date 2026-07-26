import type {
  User,
  VolunteerApplication,
  Plan,
  Project,
  ProjectType,
  Activity,
  ActivityRegistration,
  AdminTag,
  SystemSettings,
  WorkflowTemplate,
  ImageData,
} from '@/types'

// Helper to create mock image data
const createMockImage = (
  id: string,
  url: string,
  fileName: string = 'image.jpg'
): ImageData => ({
  id,
  originalUrl: url,
  thumbnailUrl: url, // In mock, same as original
  fileName,
  fileSize: 150000,
  mimeType: 'image/jpeg',
  order: 0,
})

// Mock Unsplash URLs for activities
const activityImages = {
  community: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=600&fit=crop',
  supplies: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&h=600&fit=crop',
  training: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=600&fit=crop',
}

// Default admin account
export const defaultAdmin: User = {
  id: 'admin-1',
  volunteerNumber: 'ADMIN-001',
  type: 'social',
  role: 'admin',
  adminTags: ['system-admin'],
  name: '系統管理員',
  email: 'b232914712000@gmail.com',
  phone: '0963663073',
  birthday: '1990-01-01',
  occupation: '管理員',
  experience: '系統管理',
  lineId: 'admin',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

// Mock users
export const mockUsers: User[] = [
  defaultAdmin,
  {
    id: 'user-1',
    volunteerNumber: 'Y-001',
    type: 'youth',
    role: 'volunteer',
    name: '王小明',
    email: 'xiaoming@example.com',
    phone: '0912345678',
    birthday: '2000-05-15',
    occupation: '學生',
    experience: '曾參與社區服務活動',
    lineId: 'xiaoming123',
    avatar: createMockImage('avatar-1', 'https://i.pravatar.cc/150?img=11', 'avatar.jpg'),
    status: 'active',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'user-2',
    volunteerNumber: 'S-001',
    type: 'social',
    role: 'volunteer',
    name: '李美玲',
    email: 'meiling@example.com',
    phone: '0923456789',
    birthday: '1985-08-20',
    occupation: '教師',
    experience: '十年社工經驗',
    lineId: 'meiling456',
    avatar: createMockImage('avatar-2', 'https://i.pravatar.cc/150?img=25', 'avatar.jpg'),
    status: 'active',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
]

// Mock applications
export const mockApplications: VolunteerApplication[] = [
  {
    id: 'app-1',
    token: 'token-abc123',
    name: '張三',
    email: 'zhangsan@example.com',
    phone: '0934567890',
    birthday: '1995-03-10',
    occupation: '工程師',
    experience: '想要開始參與志工活動',
    lineId: 'zhangsan789',
    status: 'pending',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
]

// Mock admin tags
export const mockAdminTags: AdminTag[] = [
  {
    id: 'tag-1',
    name: '財務組長',
    description: '負責財務審核',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tag-2',
    name: '活動組長',
    description: '負責活動管理',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tag-3',
    name: 'system-admin',
    description: '系統管理員',
    createdAt: '2024-01-01T00:00:00Z',
  },
]

// Mock project types
export const mockProjectTypes: ProjectType[] = [
  {
    id: 'type-1',
    name: '急難救助',
    budgetMin: 10000,
    budgetMax: 50000,
  },
  {
    id: 'type-2',
    name: '獎助學金',
    budgetMin: 5000,
    budgetMax: 20000,
  },
  {
    id: 'type-3',
    name: '社區服務',
    budgetMin: 3000,
    budgetMax: 15000,
  },
]

// Mock workflow templates
export const mockWorkflowTemplates: WorkflowTemplate[] = [
  {
    id: 'template-1',
    name: '標準審核流程',
    description: '適用於一般專案',
    steps: [
      { id: 'step-1', name: '提案', type: 'status' },
      { id: 'step-2', name: '主管審核', type: 'approval', approverType: 'tag', approverTagId: 'tag-2' },
      { id: 'step-3', name: '財務審核', type: 'approval', approverType: 'tag', approverTagId: 'tag-1' },
      { id: 'step-4', name: '執行中', type: 'status' },
      { id: 'step-5', name: '結案', type: 'status' },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
]

// Mock plans
export const mockPlans: Plan[] = [
  {
    id: 'plan-1',
    name: '勁力守護計畫',
    description: '協助弱勢家庭的長期計畫',
    type: '社會福利',
    workflow: mockWorkflowTemplates[0].steps,
    status: 'active',
    createdBy: 'admin-1',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
]

// Mock projects
export const mockProjects: Project[] = [
  {
    id: 'project-1',
    planId: 'plan-1',
    name: '楊五集急難救助',
    description: '楊五集地區急難救助專案',
    projectType: '急難救助',
    budgetAmount: 30000,
    workflow: [
      { id: 'step-1', name: '提案', type: 'status', status: 'approved' },
      { id: 'step-2', name: '主管審核', type: 'approval', approverType: 'tag', approverTagId: 'tag-2', status: 'approved', approvedBy: 'admin-1', approvedAt: '2024-02-01T00:00:00Z' },
      { id: 'step-3', name: '財務審核', type: 'approval', approverType: 'tag', approverTagId: 'tag-1', status: 'in_progress' },
      { id: 'step-4', name: '執行中', type: 'status', status: 'pending' },
      { id: 'step-5', name: '結案', type: 'status', status: 'pending' },
    ],
    currentStep: 2,
    status: 'active',
    createdBy: 'admin-1',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
]

// Mock activities
export const mockActivities: Activity[] = [
  {
    id: 'activity-1',
    name: '社區清潔日',
    description: '一起來清潔我們的社區環境',
    date: '2024-04-15T09:00:00Z',
    location: '中正公園',
    type: '社區服務',
    coverImage: createMockImage('cover-1', activityImages.community, 'community-cover.jpg'),
    capacity: 20,
    registrationMode: 'direct',
    status: 'upcoming',
    createdBy: 'admin-1',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'activity-2',
    projectId: 'project-1',
    name: '物資發放活動',
    description: '發放物資給需要幫助的家庭',
    date: '2024-04-20T14:00:00Z',
    location: '社區活動中心',
    type: '急難救助',
    coverImage: createMockImage('cover-2', activityImages.supplies, 'supplies-cover.jpg'),
    capacity: 10,
    registrationMode: 'approval',
    status: 'upcoming',
    createdBy: 'admin-1',
    createdAt: '2024-03-05T00:00:00Z',
    updatedAt: '2024-03-05T00:00:00Z',
  },
  {
    id: 'activity-3',
    name: '志工培訓課程',
    description: '新進志工培訓',
    date: '2024-03-10T10:00:00Z',
    location: '基金會會議室',
    type: '培訓',
    coverImage: createMockImage('cover-3', activityImages.training, 'training-cover.jpg'),
    capacity: 15,
    registrationMode: 'direct',
    status: 'completed',
    createdBy: 'admin-1',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-03-10T18:00:00Z',
  },
]

// Mock registrations
export const mockRegistrations: ActivityRegistration[] = [
  {
    id: 'reg-1',
    activityId: 'activity-1',
    userId: 'user-1',
    status: 'confirmed',
    createdAt: '2024-03-02T00:00:00Z',
    updatedAt: '2024-03-02T00:00:00Z',
  },
  {
    id: 'reg-2',
    activityId: 'activity-3',
    userId: 'user-1',
    status: 'confirmed',
    attended: true,
    serviceHours: 3,
    createdAt: '2024-02-05T00:00:00Z',
    updatedAt: '2024-03-10T18:00:00Z',
  },
  {
    id: 'reg-3',
    activityId: 'activity-3',
    userId: 'user-2',
    status: 'confirmed',
    attended: true,
    serviceHours: 3,
    createdAt: '2024-02-06T00:00:00Z',
    updatedAt: '2024-03-10T18:00:00Z',
  },
]

// System settings
export const mockSystemSettings: SystemSettings = {
  youthAgeThreshold: 30,
}
