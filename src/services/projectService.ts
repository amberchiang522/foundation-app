import type { Plan, Project, ProjectType, WorkflowTemplate } from '@/types'
import { mockPlans, mockProjects, mockProjectTypes, mockWorkflowTemplates } from '@/data/mockData'
import { useSupabase } from '@/lib/supabase'
import { supabaseProjectService } from './supabase/projectService'

// In-memory store
let plans = [...mockPlans]
let projects = [...mockProjects]
let projectTypes = [...mockProjectTypes]
let workflowTemplates = [...mockWorkflowTemplates]

const mockProjectService = {
  // Plans
  async getPlans(): Promise<Plan[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return plans
  },

  async getPlanById(id: string): Promise<Plan | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return plans.find(p => p.id === id) || null
  },

  async createPlan(data: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plan> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const newPlan: Plan = {
      ...data,
      id: `plan-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    plans.push(newPlan)
    return newPlan
  },

  async updatePlan(id: string, data: Partial<Plan>): Promise<Plan | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = plans.findIndex(p => p.id === id)
    if (index === -1) return null

    plans[index] = {
      ...plans[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return plans[index]
  },

  async archivePlan(id: string): Promise<Plan | null> {
    return this.updatePlan(id, { status: 'archived' })
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return projects
  },

  async getProjectsByPlan(planId: string): Promise<Project[]> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return projects.filter(p => p.planId === planId)
  },

  async getProjectById(id: string): Promise<Project | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return projects.find(p => p.id === id) || null
  },

  async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const newProject: Project = {
      ...data,
      organizationId: data.organizationId || undefined,
      id: `project-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    projects.push(newProject)
    return newProject
  },

  async updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = projects.findIndex(p => p.id === id)
    if (index === -1) return null

    projects[index] = {
      ...projects[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    return projects[index]
  },

  async advanceWorkflow(projectId: string, stepId: string, approverId: string, approved: boolean, note?: string): Promise<Project | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const project = await this.getProjectById(projectId)
    if (!project) return null

    const stepIndex = project.workflow.findIndex(s => s.id === stepId)
    if (stepIndex === -1) return null

    const updatedWorkflow = [...project.workflow]
    updatedWorkflow[stepIndex] = {
      ...updatedWorkflow[stepIndex],
      status: approved ? 'approved' : 'rejected',
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
      note,
    }

    // If approved and there's a next step, set it to in_progress
    if (approved && stepIndex < updatedWorkflow.length - 1) {
      updatedWorkflow[stepIndex + 1] = {
        ...updatedWorkflow[stepIndex + 1],
        status: 'in_progress',
      }
    }

    return this.updateProject(projectId, {
      workflow: updatedWorkflow,
      currentStep: approved ? stepIndex + 1 : stepIndex,
    })
  },

  async deleteProject(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = projects.findIndex(p => p.id === id)
    if (index === -1) return false

    projects.splice(index, 1)
    return true
  },

  // Project Types
  async getProjectTypes(): Promise<ProjectType[]> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return projectTypes
  },

  async createProjectType(data: Omit<ProjectType, 'id'>): Promise<ProjectType> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const newType: ProjectType = {
      ...data,
      id: `type-${Date.now()}`,
    }

    projectTypes.push(newType)
    return newType
  },

  async updateProjectType(id: string, data: Partial<ProjectType>): Promise<ProjectType | null> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = projectTypes.findIndex(t => t.id === id)
    if (index === -1) return null

    projectTypes[index] = {
      ...projectTypes[index],
      ...data,
    }
    return projectTypes[index]
  },

  async deleteProjectType(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = projectTypes.findIndex(t => t.id === id)
    if (index === -1) return false

    projectTypes.splice(index, 1)
    return true
  },

  // Workflow Templates
  async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return workflowTemplates
  },

  async createWorkflowTemplate(data: Omit<WorkflowTemplate, 'id' | 'createdAt'>): Promise<WorkflowTemplate> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const newTemplate: WorkflowTemplate = {
      ...data,
      id: `template-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }

    workflowTemplates.push(newTemplate)
    return newTemplate
  },

  // Stats
  async getStats(): Promise<{ totalPlans: number; activePlans: number; totalProjects: number; activeProjects: number }> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'active').length,
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
    }
  },
}

// Export the appropriate service based on feature flag
export const projectService = useSupabase ? supabaseProjectService : mockProjectService
