-- =====================================================
-- 鴻勁公益慈善基金會 - 志工與專案管理系統
-- Part 2: Row Level Security (RLS) Policies
-- =====================================================

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

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
-- HELPER FUNCTION: Check if user is admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES - PROFILES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

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
  USING (is_admin());

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

-- Admins can insert profiles (for approving applications)
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_admin() OR auth.uid() = id);

-- =====================================================
-- RLS POLICIES - ADMIN TAGS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view admin tags" ON admin_tags;
DROP POLICY IF EXISTS "Admins can manage admin tags" ON admin_tags;

-- Anyone authenticated can read admin tags
CREATE POLICY "Anyone can view admin tags"
  ON admin_tags FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete admin tags
CREATE POLICY "Admins can manage admin tags"
  ON admin_tags FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - USER ADMIN TAGS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view user admin tags" ON user_admin_tags;
DROP POLICY IF EXISTS "Admins can manage user admin tags" ON user_admin_tags;

CREATE POLICY "Anyone can view user admin tags"
  ON user_admin_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage user admin tags"
  ON user_admin_tags FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - VOLUNTEER APPLICATIONS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can create applications" ON volunteer_applications;
DROP POLICY IF EXISTS "Anyone can view applications by token" ON volunteer_applications;
DROP POLICY IF EXISTS "Admins can manage applications" ON volunteer_applications;

-- Anyone can create applications (public form)
CREATE POLICY "Anyone can create applications"
  ON volunteer_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can view applications (token validation in app)
CREATE POLICY "Anyone can view applications by token"
  ON volunteer_applications FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage applications"
  ON volunteer_applications FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - WORKFLOW TEMPLATES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view workflow templates" ON workflow_templates;
DROP POLICY IF EXISTS "Admins can manage workflow templates" ON workflow_templates;

CREATE POLICY "Anyone can view workflow templates"
  ON workflow_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage workflow templates"
  ON workflow_templates FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - PROJECT TYPES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view project types" ON project_types;
DROP POLICY IF EXISTS "Admins can manage project types" ON project_types;

CREATE POLICY "Anyone can view project types"
  ON project_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage project types"
  ON project_types FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - PLANS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated can view active plans" ON plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON plans;

CREATE POLICY "Authenticated can view active plans"
  ON plans FOR SELECT
  TO authenticated
  USING (status = 'active' OR is_admin());

CREATE POLICY "Admins can manage plans"
  ON plans FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - PROJECTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated can view projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON projects;

CREATE POLICY "Authenticated can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - ACTIVITIES
-- =====================================================

DROP POLICY IF EXISTS "Public can view activities" ON activities;
DROP POLICY IF EXISTS "Admins can manage activities" ON activities;

-- Public can view non-archived activities
CREATE POLICY "Public can view activities"
  ON activities FOR SELECT
  TO anon, authenticated
  USING (status != 'archived');

CREATE POLICY "Admins can manage activities"
  ON activities FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - ACTIVITY REGISTRATIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own registrations" ON activity_registrations;
DROP POLICY IF EXISTS "Users can create own registrations" ON activity_registrations;
DROP POLICY IF EXISTS "Users can update own registrations" ON activity_registrations;
DROP POLICY IF EXISTS "Admins can manage registrations" ON activity_registrations;

CREATE POLICY "Users can view own registrations"
  ON activity_registrations FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can create own registrations"
  ON activity_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own registrations"
  ON activity_registrations FOR UPDATE
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage registrations"
  ON activity_registrations FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - IMAGES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view images" ON images;
DROP POLICY IF EXISTS "Authenticated can upload images" ON images;
DROP POLICY IF EXISTS "Admins can manage images" ON images;

CREATE POLICY "Anyone can view images"
  ON images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can upload images"
  ON images FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage images"
  ON images FOR ALL
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - SYSTEM SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;

CREATE POLICY "Anyone can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update system settings"
  ON system_settings FOR UPDATE
  USING (is_admin());

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS profiles_with_tags;
DROP VIEW IF EXISTS activities_with_counts;

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
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies created successfully!';
  RAISE NOTICE 'Next step: Run 03_functions.sql';
END $$;
