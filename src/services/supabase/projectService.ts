import { supabase } from '@/lib/supabase'
import type { Plan, Project, ProjectType, WorkflowTemplate } from '@/types'

function transformPlan(row: any): Plan {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    type: row.type || '',
    workflow: row.workflow || [],
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function transformProject(row: any): Project {
  return {
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    description: row.description || '',
    projectType: row.project_type || '',
    budgetAmount: row.budget_amount,
    resultImages: row.result_images || [],
    receiptImages: row.receipt_images || [],
    workflow: row.workflow || [],
    currentStep: row.current_step,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function transformProjectType(row: any): ProjectType {
  return {
    id: row.id,
    name: row.name,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    defaultWorkflow: row.default_workflow,
  }
}

function transformWorkflowTemplate(row: any): WorkflowTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    steps: row.steps || [],
    createdAt: row.created_at,
  }
}

export const supabaseProjectService = {
  // Plans
  async getPlans(): Promise<Plan[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching plans:', error)
      return []
    }
    return data.map(transformPlan)
  },

  async getPlanById(id: string): Promise<Plan | null> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching plan:', error)
      return null
    }
    return transformPlan(data)
  },

  async createPlan(data: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plan> {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id

    const { data: newPlan, error } = await supabase
      .from('plans')
      .insert({
        name: data.name,
        description: data.description,
        type: data.type,
        workflow: data.workflow,
        status: data.status,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating plan:', error)
      throw error
    }
    return transformPlan(newPlan)
  },

  async updatePlan(id: string, data: Partial<Plan>): Promise<Plan | null> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.workflow !== undefined) updateData.workflow = data.workflow
    if (data.status !== undefined) updateData.status = data.status

    const { data: updated, error } = await supabase
      .from('plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating plan:', error)
      return null
    }
    return transformPlan(updated)
  },

  async archivePlan(id: string): Promise<Plan | null> {
    return this.updatePlan(id, { status: 'archived' })
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
      return []
    }
    return data.map(transformProject)
  },

  async getProjectsByPlan(planId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects by plan:', error)
      return []
    }
    return data.map(transformProject)
  },

  async getProjectById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching project:', error)
      return null
    }
    return transformProject(data)
  },

  async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        plan_id: data.planId,
        name: data.name,
        description: data.description,
        project_type: data.projectType,
        budget_amount: data.budgetAmount,
        result_images: data.resultImages,
        receipt_images: data.receiptImages,
        workflow: data.workflow,
        current_step: data.currentStep,
        status: data.status,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project:', error)
      throw error
    }
    return transformProject(newProject)
  },

  async updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.projectType !== undefined) updateData.project_type = data.projectType
    if (data.budgetAmount !== undefined) updateData.budget_amount = data.budgetAmount
    if (data.resultImages !== undefined) updateData.result_images = data.resultImages
    if (data.receiptImages !== undefined) updateData.receipt_images = data.receiptImages
    if (data.workflow !== undefined) updateData.workflow = data.workflow
    if (data.currentStep !== undefined) updateData.current_step = data.currentStep
    if (data.status !== undefined) updateData.status = data.status

    const { data: updated, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating project:', error)
      return null
    }
    return transformProject(updated)
  },

  async advanceWorkflow(projectId: string, stepId: string, approverId: string, approved: boolean, note?: string): Promise<Project | null> {
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

  // Project Types
  async getProjectTypes(): Promise<ProjectType[]> {
    const { data, error } = await supabase
      .from('project_types')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching project types:', error)
      return []
    }
    return data.map(transformProjectType)
  },

  async createProjectType(data: Omit<ProjectType, 'id'>): Promise<ProjectType> {
    const { data: newType, error } = await supabase
      .from('project_types')
      .insert({
        name: data.name,
        budget_min: data.budgetMin,
        budget_max: data.budgetMax,
        default_workflow: data.defaultWorkflow,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project type:', error)
      throw error
    }
    return transformProjectType(newType)
  },

  async updateProjectType(id: string, data: Partial<ProjectType>): Promise<ProjectType | null> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.budgetMin !== undefined) updateData.budget_min = data.budgetMin
    if (data.budgetMax !== undefined) updateData.budget_max = data.budgetMax
    if (data.defaultWorkflow !== undefined) updateData.default_workflow = data.defaultWorkflow

    const { data: updated, error } = await supabase
      .from('project_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating project type:', error)
      return null
    }
    return transformProjectType(updated)
  },

  async deleteProjectType(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('project_types')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting project type:', error)
      return false
    }
    return true
  },

  // Workflow Templates
  async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching workflow templates:', error)
      return []
    }
    return data.map(transformWorkflowTemplate)
  },

  async createWorkflowTemplate(data: Omit<WorkflowTemplate, 'id' | 'createdAt'>): Promise<WorkflowTemplate> {
    const { data: newTemplate, error } = await supabase
      .from('workflow_templates')
      .insert({
        name: data.name,
        description: data.description,
        steps: data.steps,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating workflow template:', error)
      throw error
    }
    return transformWorkflowTemplate(newTemplate)
  },

  // Stats
  async getStats(): Promise<{ totalPlans: number; activePlans: number; totalProjects: number; activeProjects: number }> {
    const { count: totalPlans } = await supabase
      .from('plans')
      .select('*', { count: 'exact', head: true })

    const { count: activePlans } = await supabase
      .from('plans')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { count: totalProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })

    const { count: activeProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    return {
      totalPlans: totalPlans || 0,
      activePlans: activePlans || 0,
      totalProjects: totalProjects || 0,
      activeProjects: activeProjects || 0,
    }
  },
}
