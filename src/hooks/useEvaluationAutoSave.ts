import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseProjectService } from '@/services/supabase/projectService'
import type { Project } from '@/types'

export interface EvaluationData {
  evaluationScores?: Record<string, { score: number; note: string }>
  conclusion?: string
  purposes?: string[]
  subsidyType?: 'oneTime' | 'periodic' | ''
  oneTimeMonth?: string
  oneTimeAmount?: string
  periodStart?: string
  periodEnd?: string
  frequency?: string
  periodicMonths?: string
  periodicAmount?: string
  totalScore?: number
  [key: string]: unknown  // Index signature for dynamic access
}

interface ConflictInfo {
  fieldPath: string
  fieldLabel: string
  localValue: unknown
  remoteValue: unknown
}

interface UseEvaluationAutoSaveReturn {
  data: EvaluationData
  updateField: (fieldPath: string, value: unknown) => void
  isSaving: boolean
  conflict: ConflictInfo | null
  resolveConflict: (useLocal: boolean) => void
}

// Debounce delay in milliseconds
const DEBOUNCE_MS = 500

export function useEvaluationAutoSave(
  project: Project | null,
  stepIndex: number
): UseEvaluationAutoSaveReturn {
  const [data, setData] = useState<EvaluationData>({})
  const [isSaving, setIsSaving] = useState(false)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  // Track pending local changes that haven't been synced yet
  const pendingChangesRef = useRef<Map<string, unknown>>(new Map())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const projectIdRef = useRef<string | null>(null)

  // Parse initial data from project
  useEffect(() => {
    if (!project) {
      setData({})
      return
    }

    const step = project.workflow[stepIndex]
    if (step?.note) {
      try {
        const parsed = JSON.parse(step.note) as EvaluationData
        setData(parsed)
      } catch {
        setData({})
      }
    } else {
      setData({})
    }

    // Track project ID for subscription
    projectIdRef.current = project.id
  }, [project?.id, stepIndex])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!project?.id) return

    const unsubscribe = supabaseProjectService.subscribeToProject(
      project.id,
      (updatedProject) => {
        const step = updatedProject.workflow[stepIndex]
        if (!step?.note) return

        try {
          const remoteData = JSON.parse(step.note) as EvaluationData

          // Check for conflicts with pending changes
          for (const [fieldPath, localValue] of pendingChangesRef.current.entries()) {
            const remoteValue = getNestedValue(remoteData, fieldPath)
            if (remoteValue !== undefined && JSON.stringify(remoteValue) !== JSON.stringify(localValue)) {
              // Conflict detected
              setConflict({
                fieldPath,
                fieldLabel: getFieldLabel(fieldPath),
                localValue,
                remoteValue,
              })
              return // Don't update data until conflict is resolved
            }
          }

          // No conflicts, update local data
          setData(remoteData)
        } catch {
          // Ignore parse errors
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [project?.id, stepIndex])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Save to database (debounced)
  const saveToDatabase = useCallback(async (fieldPath: string, value: unknown) => {
    if (!project?.id) return

    setIsSaving(true)
    try {
      const noteData = buildNoteData(fieldPath, value)
      await supabaseProjectService.updateStepNote(project.id, stepIndex, noteData)

      // Remove from pending changes after successful save
      pendingChangesRef.current.delete(fieldPath)
    } catch (error) {
      console.error('Failed to save evaluation field:', error)
    } finally {
      setIsSaving(false)
    }
  }, [project?.id, stepIndex])

  // Update a field (called on blur)
  const updateField = useCallback((fieldPath: string, value: unknown) => {
    // Update local state immediately
    setData(prev => setNestedValue(prev, fieldPath, value))

    // Track as pending change
    pendingChangesRef.current.set(fieldPath, value)

    // Debounce the save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToDatabase(fieldPath, value)
    }, DEBOUNCE_MS)
  }, [saveToDatabase])

  // Resolve conflict
  const resolveConflict = useCallback((useLocal: boolean) => {
    if (!conflict) return

    if (useLocal) {
      // Save local value to database
      saveToDatabase(conflict.fieldPath, conflict.localValue)
    } else {
      // Accept remote value, update local state
      setData(prev => setNestedValue(prev, conflict.fieldPath, conflict.remoteValue))
      pendingChangesRef.current.delete(conflict.fieldPath)
    }

    setConflict(null)
  }, [conflict, saveToDatabase])

  return {
    data,
    updateField,
    isSaving,
    conflict,
    resolveConflict,
  }
}

// Helper: Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// Helper: Set nested value in object using dot notation (immutable)
function setNestedValue<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.')
  const result = { ...obj } as Record<string, unknown>

  let current = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    current[part] = { ...(current[part] as Record<string, unknown> || {}) }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
  return result as T
}

// Helper: Build note data object from field path and value
function buildNoteData(fieldPath: string, value: unknown): Record<string, unknown> {
  const parts = fieldPath.split('.')
  if (parts.length === 1) {
    return { [fieldPath]: value }
  }

  // For nested paths like "evaluationScores.criteria1.score"
  const result: Record<string, unknown> = {}
  let current = result
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {}
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
  return result
}

// Helper: Get human-readable field label
function getFieldLabel(fieldPath: string): string {
  const labels: Record<string, string> = {
    conclusion: '綜合評估',
    subsidyType: '補助類型',
    oneTimeMonth: '補助月份',
    oneTimeAmount: '補助金額',
    periodStart: '補助起始日期',
    periodEnd: '補助結束日期',
    frequency: '補助頻率',
    periodicMonths: '期數',
    periodicAmount: '每期金額',
  }

  // Check for evaluation score fields
  if (fieldPath.startsWith('evaluationScores.')) {
    const parts = fieldPath.split('.')
    if (parts[2] === 'score') return `${parts[1]} 分數`
    if (parts[2] === 'note') return `${parts[1]} 說明`
  }

  return labels[fieldPath] || fieldPath
}
