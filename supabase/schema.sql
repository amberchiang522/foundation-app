-- =====================================================
-- 鴻勁公益慈善基金會 - 志工與專案管理系統
-- Supabase Database Schema
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUM TYPES
-- =====================================================

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
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  youth_age_threshold INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (youth_age_threshold) VALUES (30);

-- Admin Tags
CREATE TABLE admin_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  volunteer_number VARCHAR(20) UNIQUE,  -- Y-001 or S-001
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
CREATE TABLE user_admin_tags (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES admin_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);

-- =====================================================
-- VOLUNTEER APPLICATIONS
-- =====================================================

CREATE TABLE volunteer_applications (
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
CREATE INDEX idx_applications_email ON volunteer_applications(email);
CREATE INDEX idx_applications_token ON volunteer_applications(token);

-- =====================================================
-- WORKFLOW TEMPLATES
-- =====================================================

CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Steps stored as JSONB array of WorkflowStep
  steps JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PROJECT TYPES
-- =====================================================

CREATE TABLE project_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  budget_min NUMERIC(12, 2) NOT NULL DEFAULT 0,
  budget_max NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Default workflow template (JSONB)
  default_workflow JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PLANS
-- =====================================================

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(100),

  -- Workflow definition (JSONB array of WorkflowStep)
  -- This is the template that projects will inherit
  workflow JSONB NOT NULL DEFAULT '[]',

  status plan_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_created_by ON plans(created_by);

-- =====================================================
-- PROJECTS
-- =====================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Type and budget
  project_type VARCHAR(100),
  budget_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Images (JSONB arrays of ImageData)
  result_images JSONB DEFAULT '[]',
  receipt_images JSONB DEFAULT '[]',

  -- Workflow execution state (JSONB array of WorkflowStep with status)
  workflow JSONB NOT NULL DEFAULT '[]',
  current_step INTEGER NOT NULL DEFAULT 0,

  status project_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_plan_id ON projects(plan_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- =====================================================
-- ACTIVITIES
-- =====================================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  name VARCHAR(200) NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  location VARCHAR(200),
  type VARCHAR(100),

  -- Images (JSONB)
  cover_image JSONB,
  content_images JSONB DEFAULT '[]',

  -- Registration settings
  capacity INTEGER NOT NULL DEFAULT 0,
  registration_mode registration_mode NOT NULL DEFAULT 'direct',

  status activity_status NOT NULL DEFAULT 'upcoming',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_date ON activities(date);
CREATE INDEX idx_activities_project_id ON activities(project_id);

-- =====================================================
-- ACTIVITY REGISTRATIONS
-- =====================================================

CREATE TABLE activity_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  status registration_status NOT NULL DEFAULT 'pending',
  waitlist_position INTEGER,

  -- Review (for approval mode)
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,

  -- Attendance record
  attended BOOLEAN DEFAULT FALSE,
  service_hours NUMERIC(5, 2) DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate registrations
  UNIQUE(activity_id, user_id)
);

CREATE INDEX idx_registrations_activity ON activity_registrations(activity_id);
CREATE INDEX idx_registrations_user ON activity_registrations(user_id);
CREATE INDEX idx_registrations_status ON activity_registrations(status);

-- =====================================================
-- IMAGES (Storage metadata)
-- =====================================================

CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Storage paths
  original_url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Metadata
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Owner reference (generic - can link to any entity)
  owner_type VARCHAR(50),  -- 'activity', 'project', 'profile', 'step', etc.
  owner_id UUID,

  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_images_owner ON images(owner_type, owner_id);

-- =====================================================
-- VOLUNTEER NUMBER SEQUENCES
-- =====================================================

-- Sequences for volunteer numbers
CREATE SEQUENCE youth_volunteer_seq START 1;
CREATE SEQUENCE social_volunteer_seq START 1;

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

-- Apply updated_at trigger to tables
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER volunteer_applications_updated_at
  BEFORE UPDATE ON volunteer_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER activity_registrations_updated_at
  BEFORE UPDATE ON activity_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER project_types_updated_at
  BEFORE UPDATE ON project_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View: Profiles with admin tags
CREATE VIEW profiles_with_tags AS
SELECT
  p.*,
  COALESCE(
    array_agg(t.id) FILTER (WHERE t.id IS NOT NULL),
    '{}'::UUID[]
  ) as admin_tag_ids,
  COALESCE(
    array_agg(t.name) FILTER (WHERE t.name IS NOT NULL),
    '{}'::VARCHAR[]
  ) as admin_tag_names
FROM profiles p
LEFT JOIN user_admin_tags ut ON p.id = ut.user_id
LEFT JOIN admin_tags t ON ut.tag_id = t.id
GROUP BY p.id;

-- View: Activity with registration counts
CREATE VIEW activities_with_counts AS
SELECT
  a.*,
  COUNT(r.id) FILTER (WHERE r.status = 'confirmed') as confirmed_count,
  COUNT(r.id) FILTER (WHERE r.status = 'pending') as pending_count,
  COUNT(r.id) FILTER (WHERE r.status = 'waitlist') as waitlist_count
FROM activities a
LEFT JOIN activity_registrations r ON a.id = r.activity_id
GROUP BY a.id;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_admin_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - PROFILES
-- =====================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - ADMIN TAGS
-- =====================================================

-- Anyone authenticated can read admin tags
CREATE POLICY "Authenticated users can view admin tags"
  ON admin_tags FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage admin tags
CREATE POLICY "Admins can manage admin tags"
  ON admin_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - VOLUNTEER APPLICATIONS
-- =====================================================

-- Anyone can create applications (for public form)
CREATE POLICY "Anyone can create applications"
  ON volunteer_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Applicants can view their own applications (by email match or token)
CREATE POLICY "Public can view by token"
  ON volunteer_applications FOR SELECT
  TO anon, authenticated
  USING (true);  -- Token validation done in application

-- Admins can view and update all applications
CREATE POLICY "Admins can manage applications"
  ON volunteer_applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - ACTIVITIES
-- =====================================================

-- Public can view published activities
CREATE POLICY "Public can view activities"
  ON activities FOR SELECT
  TO anon, authenticated
  USING (status != 'archived');

-- Admins can manage all activities
CREATE POLICY "Admins can manage activities"
  ON activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - ACTIVITY REGISTRATIONS
-- =====================================================

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations"
  ON activity_registrations FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own registrations
CREATE POLICY "Users can create own registrations"
  ON activity_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own registrations (cancel)
CREATE POLICY "Users can update own registrations"
  ON activity_registrations FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can manage all registrations
CREATE POLICY "Admins can manage registrations"
  ON activity_registrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - PLANS & PROJECTS
-- =====================================================

-- Authenticated users can view active plans
CREATE POLICY "Authenticated can view active plans"
  ON plans FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Admins can manage all plans
CREATE POLICY "Admins can manage plans"
  ON plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can view projects
CREATE POLICY "Authenticated can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage all projects
CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - OTHER TABLES
-- =====================================================

-- Workflow templates - admins only
CREATE POLICY "Admins can manage workflow templates"
  ON workflow_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Project types - read for authenticated, manage for admins
CREATE POLICY "Authenticated can view project types"
  ON project_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage project types"
  ON project_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- System settings - read for authenticated, update for admins
CREATE POLICY "Authenticated can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update system settings"
  ON system_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Images - owner can manage their images
CREATE POLICY "Users can view images"
  ON images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload images"
  ON images FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can manage all images"
  ON images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default admin tags
INSERT INTO admin_tags (name, description) VALUES
  ('主管', '計畫主管，可審核計畫與專案'),
  ('財務', '財務人員，可處理撥款審核'),
  ('活動', '活動負責人，可管理活動');

-- Insert default project types
INSERT INTO project_types (name, budget_min, budget_max) VALUES
  ('急難救助', 10000, 100000),
  ('獎助學金', 5000, 50000),
  ('一般補助', 1000, 30000);

-- Insert default workflow template
INSERT INTO workflow_templates (name, description, steps) VALUES
  ('標準審核流程', '包含提案、主管審核、財務審核、執行與結案的標準流程',
   '[
     {"id": "step-1", "name": "提案", "type": "status"},
     {"id": "step-2", "name": "主管審核", "type": "approval"},
     {"id": "step-3", "name": "財務審核", "type": "approval"},
     {"id": "step-4", "name": "執行中", "type": "status"},
     {"id": "step-5", "name": "結案", "type": "status"}
   ]'::JSONB
  );

-- =====================================================
-- STORAGE BUCKETS (run via Supabase Dashboard or API)
-- =====================================================

-- Note: Storage buckets need to be created via Supabase Dashboard or API
-- Suggested buckets:
-- 1. 'avatars' - User profile pictures
-- 2. 'activities' - Activity cover and content images
-- 3. 'projects' - Project result and receipt images
-- 4. 'attachments' - Workflow step attachments

-- Storage policies example (run in SQL editor with storage schema access):
/*
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('activities', 'activities', true),
  ('projects', 'projects', true),
  ('attachments', 'attachments', false);
*/
