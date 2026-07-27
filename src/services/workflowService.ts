import type {
  WorkflowStepExecution,
  WorkflowStepExecutionWithDetails,
  ImageData,
  VerificationStatus,
} from '@/types'
import { useSupabase } from '@/lib/supabase'
import { supabaseWorkflowService } from './supabase/workflowService'

// In-memory store for mock
let executions: WorkflowStepExecution[] = []

const mockWorkflowService = {
  // Get all executions for a project step
  async getStepExecutions(
    projectId: string,
    stepId: string,
    round?: number
  ): Promise<WorkflowStepExecutionWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 200))

    let result = executions.filter(
      e => e.projectId === projectId && e.stepId === stepId
    )

    if (round !== undefined) {
      result = result.filter(e => e.round === round)
    }

    // Sort by created date, newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return result as WorkflowStepExecutionWithDetails[]
  },

  // Get latest round executions for a step
  async getLatestRoundExecutions(
    projectId: string,
    stepId: string
  ): Promise<WorkflowStepExecutionWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 200))

    const stepExecutions = executions.filter(
      e => e.projectId === projectId && e.stepId === stepId
    )

    if (stepExecutions.length === 0) return []

    const latestRound = Math.max(...stepExecutions.map(e => e.round))
    return stepExecutions.filter(e => e.round === latestRound) as WorkflowStepExecutionWithDetails[]
  },

  // Get all executions for a project (for history view)
  async getProjectExecutions(projectId: string): Promise<WorkflowStepExecutionWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 200))

    return executions
      .filter(e => e.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as WorkflowStepExecutionWithDetails[]
  },

  // Get pending executions for a user (steps they need to verify)
  async getPendingVerifications(userId: string): Promise<WorkflowStepExecutionWithDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 200))

    // In real implementation, would check if user can verify based on verifier settings
    return executions
      .filter(e => e.verificationStatus === 'pending' && e.executedBy)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as WorkflowStepExecutionWithDetails[]
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
    await new Promise(resolve => setTimeout(resolve, 300))

    // Find existing executions for this step to determine round
    const stepExecutions = executions.filter(
      e => e.projectId === projectId && e.stepId === stepId
    )
    const currentRound = stepExecutions.length > 0
      ? Math.max(...stepExecutions.map(e => e.round))
      : 1

    const newExecution: WorkflowStepExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      stepId,
      round: currentRound,
      executedBy: userId,
      executedAt: new Date().toISOString(),
      content: data.content,
      attachments: data.attachments || [],
      verificationStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    executions.push(newExecution)
    return newExecution
  },

  // Verify an execution (verifier approves/rejects)
  async verifyExecution(
    executionId: string,
    userId: string,
    approved: boolean,
    rejectReason?: string
  ): Promise<WorkflowStepExecution | null> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const index = executions.findIndex(e => e.id === executionId)
    if (index === -1) return null

    const execution = executions[index]
    if (execution.verificationStatus !== 'pending') {
      throw new Error('This execution has already been processed')
    }

    const updatedExecution: WorkflowStepExecution = {
      ...execution,
      verificationStatus: approved ? 'approved' : 'rejected',
      verifiedBy: userId,
      verifiedAt: new Date().toISOString(),
      rejectReason: approved ? undefined : rejectReason,
      updatedAt: new Date().toISOString(),
    }

    executions[index] = updatedExecution

    // If approved, void all other pending executions for this step/round
    if (approved) {
      executions = executions.map(e => {
        if (
          e.projectId === execution.projectId &&
          e.stepId === execution.stepId &&
          e.round === execution.round &&
          e.id !== executionId &&
          e.verificationStatus === 'pending'
        ) {
          return {
            ...e,
            verificationStatus: 'voided' as VerificationStatus,
            updatedAt: new Date().toISOString(),
          }
        }
        return e
      })
    }

    return updatedExecution
  },

  // Start a new round (after rejection)
  async startNewRound(
    projectId: string,
    stepId: string,
    assigneeType?: 'tag' | 'person',
    assigneeTagId?: string,
    assigneeUserId?: string
  ): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 200))

    const stepExecutions = executions.filter(
      e => e.projectId === projectId && e.stepId === stepId
    )
    const currentRound = stepExecutions.length > 0
      ? Math.max(...stepExecutions.map(e => e.round))
      : 0

    return currentRound + 1
  },

  // Check if user can execute a step
  async canExecuteStep(
    projectId: string,
    stepId: string,
    userId: string,
    userAdminTags?: string[]
  ): Promise<boolean> {
    // In mock mode, always return true for admins
    // Real implementation would check assignee settings
    return true
  },

  // Check if user can verify a step
  async canVerifyStep(
    projectId: string,
    stepId: string,
    userId: string,
    userAdminTags?: string[]
  ): Promise<boolean> {
    // In mock mode, always return true for admins
    // Real implementation would check verifier settings
    return true
  },

  // Get execution by ID
  async getExecutionById(executionId: string): Promise<WorkflowStepExecutionWithDetails | null> {
    await new Promise(resolve => setTimeout(resolve, 200))
    const execution = executions.find(e => e.id === executionId)
    return execution as WorkflowStepExecutionWithDetails | null
  },

  // Get stats for dashboard
  async getStats(): Promise<{
    pendingExecutions: number
    pendingVerifications: number
    completedToday: number
  }> {
    await new Promise(resolve => setTimeout(resolve, 200))

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      pendingExecutions: executions.filter(e => !e.executedBy && e.verificationStatus === 'pending').length,
      pendingVerifications: executions.filter(e => e.executedBy && e.verificationStatus === 'pending').length,
      completedToday: executions.filter(e =>
        e.verificationStatus === 'approved' &&
        e.verifiedAt &&
        new Date(e.verifiedAt) >= today
      ).length,
    }
  },
}

// Export the appropriate service based on feature flag
export const workflowService = useSupabase ? supabaseWorkflowService : mockWorkflowService
