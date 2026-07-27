import { supabase } from '@/lib/supabase'
import type {
  WorkflowStepExecution,
  WorkflowStepExecutionWithDetails,
  ImageData,
} from '@/types'

export const supabaseWorkflowService = {
  // Get all executions for a project step
  async getStepExecutions(
    projectId: string,
    stepId: string,
    round?: number
  ): Promise<WorkflowStepExecutionWithDetails[]> {
    let query = supabase
      .from('workflow_step_executions')
      .select(`
        *,
        executor:profiles!workflow_step_executions_executed_by_fkey(id, name),
        verifier:profiles!workflow_step_executions_verified_by_fkey(id, name)
      `)
      .eq('project_id', projectId)
      .eq('step_id', stepId)
      .order('created_at', { ascending: false })

    if (round !== undefined) {
      query = query.eq('round', round)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(mapExecutionFromDb)
  },

  // Get latest round executions for a step
  async getLatestRoundExecutions(
    projectId: string,
    stepId: string
  ): Promise<WorkflowStepExecutionWithDetails[]> {
    // First get the max round
    const { data: roundData } = await supabase
      .from('workflow_step_executions')
      .select('round')
      .eq('project_id', projectId)
      .eq('step_id', stepId)
      .order('round', { ascending: false })
      .limit(1)
      .single()

    if (!roundData) return []

    return this.getStepExecutions(projectId, stepId, roundData.round)
  },

  // Get all executions for a project (for history view)
  async getProjectExecutions(projectId: string): Promise<WorkflowStepExecutionWithDetails[]> {
    const { data, error } = await supabase
      .from('workflow_step_executions')
      .select(`
        *,
        executor:profiles!workflow_step_executions_executed_by_fkey(id, name),
        verifier:profiles!workflow_step_executions_verified_by_fkey(id, name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(mapExecutionFromDb)
  },

  // Get pending executions for a user (steps they need to verify)
  async getPendingVerifications(userId: string): Promise<WorkflowStepExecutionWithDetails[]> {
    const { data, error } = await supabase
      .from('workflow_step_executions')
      .select(`
        *,
        executor:profiles!workflow_step_executions_executed_by_fkey(id, name),
        verifier:profiles!workflow_step_executions_verified_by_fkey(id, name)
      `)
      .eq('verification_status', 'pending')
      .not('executed_by', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(mapExecutionFromDb)
  },

  // Submit an execution (assignee submits work)
  async submitExecution(
    projectId: string,
    stepId: string,
    userId: string,
    data: {
      content?: string
      attachments?: ImageData[]
    }
  ): Promise<WorkflowStepExecution> {
    // Get current round for this step
    const { data: roundData } = await supabase
      .from('workflow_step_executions')
      .select('round')
      .eq('project_id', projectId)
      .eq('step_id', stepId)
      .order('round', { ascending: false })
      .limit(1)
      .single()

    const currentRound = roundData?.round || 1

    const { data: execution, error } = await supabase
      .from('workflow_step_executions')
      .insert({
        project_id: projectId,
        step_id: stepId,
        round: currentRound,
        executed_by: userId,
        executed_at: new Date().toISOString(),
        content: data.content,
        attachments: data.attachments || [],
        verification_status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    return mapExecutionFromDb(execution)
  },

  // Verify an execution (verifier approves/rejects)
  async verifyExecution(
    executionId: string,
    userId: string,
    approved: boolean,
    rejectReason?: string
  ): Promise<WorkflowStepExecution | null> {
    const { data: execution, error } = await supabase
      .from('workflow_step_executions')
      .update({
        verification_status: approved ? 'approved' : 'rejected',
        verified_by: userId,
        verified_at: new Date().toISOString(),
        reject_reason: approved ? null : rejectReason,
      })
      .eq('id', executionId)
      .eq('verification_status', 'pending')
      .select()
      .single()

    if (error) throw error
    if (!execution) return null

    // The trigger will automatically void other pending executions

    return mapExecutionFromDb(execution)
  },

  // Start a new round (after rejection)
  async startNewRound(
    projectId: string,
    stepId: string,
    assigneeType?: 'tag' | 'person',
    assigneeTagId?: string,
    assigneeUserId?: string
  ): Promise<number> {
    const { data: roundData } = await supabase
      .from('workflow_step_executions')
      .select('round')
      .eq('project_id', projectId)
      .eq('step_id', stepId)
      .order('round', { ascending: false })
      .limit(1)
      .single()

    return (roundData?.round || 0) + 1
  },

  // Check if user can execute a step
  async canExecuteStep(
    projectId: string,
    stepId: string,
    userId: string,
    userAdminTags?: string[]
  ): Promise<boolean> {
    // Get step definition
    const { data: step } = await supabase
      .from('workflow_step_definitions')
      .select('*')
      .eq('project_id', projectId)
      .eq('step_id', stepId)
      .single()

    if (!step) return false

    // Get user role
    const { data: user } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!user) return false

    // Super admin can always execute
    if (user.role === 'super_admin') return true

    // Must be admin
    if (user.role !== 'admin') return false

    // Check assignee settings
    if (step.assignee_type === 'person') {
      return step.assignee_user_id === userId
    }

    if (step.assignee_type === 'tag' && step.assignee_tag_id) {
      // Check user_admin_tags table
      const { data: tagData } = await supabase
        .from('user_admin_tags')
        .select('tag_id')
        .eq('user_id', userId)
        .eq('tag_id', step.assignee_tag_id)
        .single()
      return !!tagData
    }

    return true
  },

  // Check if user can verify a step
  async canVerifyStep(
    projectId: string,
    stepId: string,
    userId: string,
    userAdminTags?: string[]
  ): Promise<boolean> {
    // Get step definition
    const { data: step } = await supabase
      .from('workflow_step_definitions')
      .select('*')
      .eq('project_id', projectId)
      .eq('step_id', stepId)
      .single()

    if (!step) return false

    // Get user role
    const { data: user } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!user) return false

    // Super admin can always verify
    if (user.role === 'super_admin') return true

    // Must be admin
    if (user.role !== 'admin') return false

    // Check verifier settings
    if (step.verifier_type === 'person') {
      return step.verifier_user_id === userId
    }

    if (step.verifier_type === 'tag' && step.verifier_tag_id) {
      // Check user_admin_tags table
      const { data: tagData } = await supabase
        .from('user_admin_tags')
        .select('tag_id')
        .eq('user_id', userId)
        .eq('tag_id', step.verifier_tag_id)
        .single()
      return !!tagData
    }

    return true
  },

  // Get execution by ID
  async getExecutionById(executionId: string): Promise<WorkflowStepExecutionWithDetails | null> {
    const { data, error } = await supabase
      .from('workflow_step_executions')
      .select(`
        *,
        executor:profiles!workflow_step_executions_executed_by_fkey(id, name),
        verifier:profiles!workflow_step_executions_verified_by_fkey(id, name)
      `)
      .eq('id', executionId)
      .single()

    if (error) throw error
    if (!data) return null

    return mapExecutionFromDb(data)
  },

  // Get stats for dashboard
  async getStats(): Promise<{
    pendingExecutions: number
    pendingVerifications: number
    completedToday: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [pendingExec, pendingVerify, completed] = await Promise.all([
      supabase
        .from('workflow_step_executions')
        .select('id', { count: 'exact', head: true })
        .is('executed_by', null)
        .eq('verification_status', 'pending'),

      supabase
        .from('workflow_step_executions')
        .select('id', { count: 'exact', head: true })
        .not('executed_by', 'is', null)
        .eq('verification_status', 'pending'),

      supabase
        .from('workflow_step_executions')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'approved')
        .gte('verified_at', today.toISOString()),
    ])

    return {
      pendingExecutions: pendingExec.count || 0,
      pendingVerifications: pendingVerify.count || 0,
      completedToday: completed.count || 0,
    }
  },
}

// Helper to map database record to TypeScript type
function mapExecutionFromDb(record: Record<string, unknown>): WorkflowStepExecutionWithDetails {
  return {
    id: record.id as string,
    projectId: record.project_id as string,
    stepId: record.step_id as string,
    round: record.round as number,
    assigneeType: record.assignee_type as 'tag' | 'person' | undefined,
    assigneeTagId: record.assignee_tag_id as string | undefined,
    assigneeUserId: record.assignee_user_id as string | undefined,
    verifierType: record.verifier_type as 'tag' | 'person' | undefined,
    verifierTagId: record.verifier_tag_id as string | undefined,
    verifierUserId: record.verifier_user_id as string | undefined,
    executedBy: record.executed_by as string | undefined,
    executedAt: record.executed_at as string | undefined,
    content: record.content as string | undefined,
    attachments: (record.attachments as ImageData[]) || [],
    verificationStatus: record.verification_status as 'pending' | 'approved' | 'rejected' | 'voided',
    verifiedBy: record.verified_by as string | undefined,
    verifiedAt: record.verified_at as string | undefined,
    rejectReason: record.reject_reason as string | undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
    executor: record.executor as { id: string; name: string } | undefined,
    verifier: record.verifier as { id: string; name: string } | undefined,
  }
}
