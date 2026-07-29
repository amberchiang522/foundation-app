-- Add plan_ids column to organizations table for many-to-many relationship
-- This replaces the single project_id with an array of plan IDs

-- Add plan_ids column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'plan_ids'
  ) THEN
    ALTER TABLE organizations ADD COLUMN plan_ids TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- If there's an existing project_id column, we can migrate data (optional)
-- This converts existing project_id to plan_ids array
-- Uncomment if you have existing data to migrate:
-- UPDATE organizations SET plan_ids = ARRAY[project_id] WHERE project_id IS NOT NULL;

-- Create index for faster array containment queries
CREATE INDEX IF NOT EXISTS idx_organizations_plan_ids ON organizations USING GIN (plan_ids);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO authenticated;
