import { supabase } from '@/lib/supabase'
import type { Plan, Project, ProjectType, WorkflowTemplate } from '@/types'

function transformPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    type: (row.type as string) || '',
    workflow: (row.workflow as Plan['workflow']) || [],
    status: row.status as Plan['status'],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function transformProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    organizationId: (row.organization_id as string) || undefined,
    name: row.name as string,
    description: (row.description as string) || '',
    projectType: (row.project_type as string) || '',
    budgetAmount: row.budget_amount as number,
    resultImages: (row.result_images as Project['resultImages']) || [],
    receiptImages: (row.receipt_images as Project['receiptImages']) || [],
    workflow: (row.workflow as Project['workflow']) || [],
    currentStep: row.current_step as number,
    status: row.status as Project['status'],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function transformProjectType(row: Record<string, unknown>): ProjectType {
  return {
    id: row.id as string,
    name: row.name as string,
    budgetMin: row.budget_min as number,
    budgetMax: row.budget_max as number,
    defaultWorkflow: row.default_workflow as ProjectType['defaultWorkflow'],
  }
}

function transformWorkflowTemplate(row: Record<string, unknown>): WorkflowTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    steps: (row.steps as WorkflowTemplate['steps']) || [],
    createdAt: row.created_at as string,
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
    return (data || []).map(row => transformPlan(row as Record<string, unknown>))
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
    return transformPlan(data as Record<string, unknown>)
  },

  async createPlan(planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plan> {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id

    const { data: newPlan, error } = await supabase
      .from('plans')
      .insert({
        name: planData.name,
        description: planData.description,
        type: planData.type,
        workflow: planData.workflow,
        status: planData.status,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating plan:', error)
      throw error
    }
    return transformPlan(newPlan as Record<string, unknown>)
  },

  async updatePlan(id: string, planData: Partial<Plan>): Promise<Plan | null> {
    const updateData: Record<string, unknown> = {}
    if (planData.name !== undefined) updateData.name = planData.name
    if (planData.description !== undefined) updateData.description = planData.description
    if (planData.type !== undefined) updateData.type = planData.type
    if (planData.workflow !== undefined) updateData.workflow = planData.workflow
    if (planData.status !== undefined) updateData.status = planData.status

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
    return transformPlan(updated as Record<string, unknown>)
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
    return (data || []).map(row => transformProject(row as Record<string, unknown>))
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
    return (data || []).map(row => transformProject(row as Record<string, unknown>))
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
    return transformProject(data as Record<string, unknown>)
  },

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        plan_id: projectData.planId,
        organization_id: projectData.organizationId || null,
        name: projectData.name,
        description: projectData.description,
        project_type: projectData.projectType,
        budget_amount: projectData.budgetAmount,
        result_images: projectData.resultImages,
        receipt_images: projectData.receiptImages,
        workflow: projectData.workflow,
        current_step: projectData.currentStep,
        status: projectData.status,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project:', error)
      throw error
    }
    return transformProject(newProject as Record<string, unknown>)
  },

  async updateProject(id: string, projectData: Partial<Project>): Promise<Project | null> {
    const updateData: Record<string, unknown> = {}
    if (projectData.name !== undefined) updateData.name = projectData.name
    if (projectData.description !== undefined) updateData.description = projectData.description
    if (projectData.organizationId !== undefined) updateData.organization_id = projectData.organizationId || null
    if (projectData.projectType !== undefined) updateData.project_type = projectData.projectType
    if (projectData.budgetAmount !== undefined) updateData.budget_amount = projectData.budgetAmount
    if (projectData.resultImages !== undefined) updateData.result_images = projectData.resultImages
    if (projectData.receiptImages !== undefined) updateData.receipt_images = projectData.receiptImages
    if (projectData.workflow !== undefined) updateData.workflow = projectData.workflow
    if (projectData.currentStep !== undefined) updateData.current_step = projectData.currentStep
    if (projectData.status !== undefined) updateData.status = projectData.status

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
    return transformProject(updated as Record<string, unknown>)
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
    return (data || []).map(row => transformProjectType(row as Record<string, unknown>))
  },

  async createProjectType(typeData: Omit<ProjectType, 'id'>): Promise<ProjectType> {
    const { data: newType, error } = await supabase
      .from('project_types')
      .insert({
        name: typeData.name,
        budget_min: typeData.budgetMin,
        budget_max: typeData.budgetMax,
        default_workflow: typeData.defaultWorkflow,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project type:', error)
      throw error
    }
    return transformProjectType(newType as Record<string, unknown>)
  },

  async updateProjectType(id: string, typeData: Partial<ProjectType>): Promise<ProjectType | null> {
    const updateData: Record<string, unknown> = {}
    if (typeData.name !== undefined) updateData.name = typeData.name
    if (typeData.budgetMin !== undefined) updateData.budget_min = typeData.budgetMin
    if (typeData.budgetMax !== undefined) updateData.budget_max = typeData.budgetMax
    if (typeData.defaultWorkflow !== undefined) updateData.default_workflow = typeData.defaultWorkflow

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
    return transformProjectType(updated as Record<string, unknown>)
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
    return (data || []).map(row => transformWorkflowTemplate(row as Record<string, unknown>))
  },

  async createWorkflowTemplate(templateData: Omit<WorkflowTemplate, 'id' | 'createdAt'>): Promise<WorkflowTemplate> {
    const { data: newTemplate, error } = await supabase
      .from('workflow_templates')
      .insert({
        name: templateData.name,
        description: templateData.description,
        steps: templateData.steps,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating workflow template:', error)
      throw error
    }
    return transformWorkflowTemplate(newTemplate as Record<string, unknown>)
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
