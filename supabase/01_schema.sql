-- =====================================================
-- 鴻勁公益慈善基金會 - 志工與專案管理系統
-- Part 1: Core Schema (Tables, Types, Indexes)
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Drop existing types if re-running
DROP TYPE IF EXISTS volunteer_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS application_status CASCADE;
DROP TYPE IF EXISTS plan_status CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS activity_status CASCADE;
DROP TYPE IF EXISTS registration_mode CASCADE;
DROP TYPE IF EXISTS registration_status CASCADE;
DROP TYPE IF EXISTS workflow_step_type CASCADE;
DROP TYPE IF EXISTS workflow_step_status CASCADE;
DROP TYPE IF EXISTS approver_type CASCADE;

-- Volunteer type
CREATE TYPE volunteer_type AS ENUM ('youth', 'social');

-- User role
CREATE TYPE user_role AS ENUM ('volunteer', 'admin');

-- User status
CREATE TYPE user_status AS ENUM ('active', 'suspended');

-- Application status
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected', 'needs_revision');

-- Plan status
CREATE TYPE plan_status AS ENUM ('active', 'archived');

-- Project status
CREATE TYPE project_status AS ENUM ('active', 'completed', 'archived', 'not_established');

-- Activity status
CREATE TYPE activity_status AS ENUM ('upcoming', 'ongoing', 'completed', 'archived');

-- Registration mode
CREATE TYPE registration_mode AS ENUM ('direct', 'approval');

-- Registration status
CREATE TYPE registration_status AS ENUM ('confirmed', 'pending', 'waitlist', 'cancelled');

-- Workflow step type
CREATE TYPE workflow_step_type AS ENUM ('status', 'approval', 'establishment');

-- Workflow step status
CREATE TYPE workflow_step_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'not_established');

-- Approver type
CREATE TYPE approver_type AS ENUM ('tag', 'person');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- System Settings (singleton table)
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  youth_age_threshold INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO system_settings (youth_age_threshold)
SELECT 30 WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Admin Tags
CREATE TABLE IF NOT EXISTS admin_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Profiles (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  volunteer_number VARCHAR(20) UNIQUE,
  type volunteer_type NOT NULL DEFAULT 'social',
  role user_role NOT NULL DEFAULT 'volunteer',

  -- Basic info
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  birthday DATE NOT NULL,
  occupation VARCHAR(100),
  experience TEXT,
  line_id VARCHAR(100),

  -- Avatar (JSONB for ImageData)
  avatar JSONB,

  -- Status
  status user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-Admin Tags junction table
CREATE TABLE IF NOT EXISTS user_admin_tags (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES admin_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);

-- =====================================================
-- VOLUNTEER APPLICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS volunteer_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Form data
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  birthday DATE NOT NULL,
  occupation VARCHAR(100),
  experience TEXT,
  line_id VARCHAR(100),

  -- Review status
  status application_status NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_applications_email ON volunteer_applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_token ON volunteer_applications(token);

-- =====================================================
-- WORKFLOW TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PROJECT TYPES
-- =====================================================

CREATE TABLE IF NOT EXISTS project_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  budget_min NUMERIC(12, 2) NOT NULL DEFAULT 0,
  budget_max NUMERIC(12, 2) NOT NULL DEFAULT 0,
  default_workflow JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PLANS
-- =====================================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(100),
  workflow JSONB NOT NULL DEFAULT '[]',
  status plan_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_created_by ON plans(created_by);

-- =====================================================
-- PROJECTS
-- =====================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  project_type VARCHAR(100),
  budget_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  result_images JSONB DEFAULT '[]',
  receipt_images JSONB DEFAULT '[]',
  workflow JSONB NOT NULL DEFAULT '[]',
  current_step INTEGER NOT NULL DEFAULT 0,
  status project_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_plan_id ON projects(plan_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- =====================================================
-- ACTIVITIES
-- =====================================================

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  location VARCHAR(200),
  type VARCHAR(100),
  cover_image JSONB,
  content_images JSONB DEFAULT '[]',
  capacity INTEGER NOT NULL DEFAULT 0,
  registration_mode registration_mode NOT NULL DEFAULT 'direct',
  status activity_status NOT NULL DEFAULT 'upcoming',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);

-- =====================================================
-- ACTIVITY REGISTRATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status registration_status NOT NULL DEFAULT 'pending',
  waitlist_position INTEGER,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  attended BOOLEAN DEFAULT FALSE,
  service_hours NUMERIC(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_activity ON activity_registrations(activity_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON activity_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON activity_registrations(status);

-- =====================================================
-- IMAGES (Storage metadata)
-- =====================================================

CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  owner_type VARCHAR(50),
  owner_id UUID,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_owner ON images(owner_type, owner_id);

-- =====================================================
-- VOLUNTEER NUMBER SEQUENCES
-- =====================================================

-- Create sequences if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'youth_volunteer_seq') THEN
    CREATE SEQUENCE youth_volunteer_seq START 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'social_volunteer_seq') THEN
    CREATE SEQUENCE social_volunteer_seq START 1;
  END IF;
END $$;

-- Function to generate volunteer number
CREATE OR REPLACE FUNCTION generate_volunteer_number(v_type volunteer_type)
RETURNS VARCHAR(20) AS $$
DECLARE
  prefix CHAR(1);
  seq_val INTEGER;
BEGIN
  IF v_type = 'youth' THEN
    prefix := 'Y';
    seq_val := nextval('youth_volunteer_seq');
  ELSE
    prefix := 'S';
    seq_val := nextval('social_volunteer_seq');
  END IF;
  RETURN prefix || '-' || LPAD(seq_val::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS activities_updated_at ON activities;
CREATE TRIGGER activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS volunteer_applications_updated_at ON volunteer_applications;
CREATE TRIGGER volunteer_applications_updated_at
  BEFORE UPDATE ON volunteer_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS activity_registrations_updated_at ON activity_registrations;
CREATE TRIGGER activity_registrations_updated_at
  BEFORE UPDATE ON activity_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS system_settings_updated_at ON system_settings;
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_types_updated_at ON project_types;
CREATE TRIGGER project_types_updated_at
  BEFORE UPDATE ON project_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default admin tags
INSERT INTO admin_tags (name, description) VALUES
  ('主管', '計畫主管，可審核計畫與專案'),
  ('財務', '財務人員，可處理撥款審核'),
  ('活動', '活動負責人，可管理活動')
ON CONFLICT (name) DO NOTHING;

-- Insert default project types
INSERT INTO project_types (name, budget_min, budget_max) VALUES
  ('急難救助', 10000, 100000),
  ('獎助學金', 5000, 50000),
  ('一般補助', 1000, 30000)
ON CONFLICT (name) DO NOTHING;

-- Insert default workflow template
INSERT INTO workflow_templates (name, description, steps)
SELECT '標準審核流程', '包含提案、主管審核、財務審核、執行與結案的標準流程',
   '[
     {"id": "step-1", "name": "提案", "type": "status"},
     {"id": "step-2", "name": "主管審核", "type": "approval"},
     {"id": "step-3", "name": "財務審核", "type": "approval"},
     {"id": "step-4", "name": "執行中", "type": "status"},
     {"id": "step-5", "name": "結案", "type": "status"}
   ]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE name = '標準審核流程');

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Schema created successfully!';
  RAISE NOTICE 'Next step: Run 02_rls.sql';
END $$;
