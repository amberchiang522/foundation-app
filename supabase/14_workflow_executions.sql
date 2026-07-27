-- =====================================================
-- 14. Workflow Step Executions & Dual Role System
-- =====================================================
-- This migration adds:
-- 1. workflow_step_executions table for tracking execution history
-- 2. Updates projects table with organization_id

-- =====================================================
-- 1. Add organization_id to projects table
-- =====================================================
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Index for organization lookups
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);

-- =====================================================
-- 2. Create workflow_step_executions table
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,  -- References workflow step id within project
    round INTEGER NOT NULL DEFAULT 1,  -- Execution round (increments on rejection)

    -- Assignee info
    assignee_type TEXT CHECK (assignee_type IN ('tag', 'person')),
    assignee_tag_id UUID REFERENCES admin_tags(id) ON DELETE SET NULL,
    assignee_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Verifier info
    verifier_type TEXT CHECK (verifier_type IN ('tag', 'person')),
    verifier_tag_id UUID REFERENCES admin_tags(id) ON DELETE SET NULL,
    verifier_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Execution data (submitted by assignee)
    executed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ,
    content TEXT,  -- Text content submitted
    attachments JSONB DEFAULT '[]'::jsonb,  -- Array of attachment objects

    -- Verification result
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'approved', 'rejected', 'voided')),
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    reject_reason TEXT,  -- Required when rejected

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflow_executions_project_id ON workflow_step_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_step_id ON workflow_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_project_step ON workflow_step_executions(project_id, step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_step_executions(verification_status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_executed_by ON workflow_step_executions(executed_by);

-- =====================================================
-- 3. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;

-- Workflow executions policies
CREATE POLICY "workflow_executions_select_policy" ON workflow_step_executions
    FOR SELECT TO authenticated
    USING (true);  -- All authenticated users can view

CREATE POLICY "workflow_executions_insert_policy" ON workflow_step_executions
    FOR INSERT TO authenticated
    WITH CHECK (
        -- User must be admin
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "workflow_executions_update_policy" ON workflow_step_executions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- =====================================================
-- 4. Triggers for updated_at
-- =====================================================

-- Trigger for workflow_step_executions
CREATE TRIGGER update_workflow_executions_updated_at
    BEFORE UPDATE ON workflow_step_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 5. Function to void other executions when one is approved
-- =====================================================

CREATE OR REPLACE FUNCTION void_other_executions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.verification_status = 'approved' AND OLD.verification_status = 'pending' THEN
        -- Void all other pending executions for the same step and round
        UPDATE workflow_step_executions
        SET
            verification_status = 'voided',
            updated_at = NOW()
        WHERE
            project_id = NEW.project_id
            AND step_id = NEW.step_id
            AND round = NEW.round
            AND id != NEW.id
            AND verification_status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to void other executions
DROP TRIGGER IF EXISTS void_other_executions_trigger ON workflow_step_executions;
CREATE TRIGGER void_other_executions_trigger
    AFTER UPDATE ON workflow_step_executions
    FOR EACH ROW
    EXECUTE FUNCTION void_other_executions();

-- =====================================================
-- 6. View for execution summary
-- =====================================================

CREATE OR REPLACE VIEW v_workflow_execution_summary AS
SELECT
    wse.id,
    wse.project_id,
    wse.step_id,
    wse.round,
    wse.verification_status,
    wse.content,
    wse.attachments,
    wse.reject_reason,
    wse.created_at,
    wse.executed_at,
    wse.verified_at,
    p.name AS project_name,
    executor.name AS executor_name,
    executor.id AS executor_id,
    verifier.name AS verifier_name,
    verifier.id AS verifier_id
FROM workflow_step_executions wse
LEFT JOIN projects p ON p.id = wse.project_id
LEFT JOIN profiles executor ON executor.id = wse.executed_by
LEFT JOIN profiles verifier ON verifier.id = wse.verified_by
ORDER BY wse.created_at DESC;

-- Grant access to the view
GRANT SELECT ON v_workflow_execution_summary TO authenticated;

-- =====================================================
-- Done
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Workflow executions module created successfully!';
END $$;
