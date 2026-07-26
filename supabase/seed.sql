-- =====================================================
-- 鴻勁公益慈善基金會 - 種子資料
-- Seed Data for Development/Testing
-- =====================================================

-- Note: This file should be run AFTER schema.sql
-- The default admin user needs to be created through Supabase Auth first

-- =====================================================
-- TEST DATA: Admin Tags (already inserted in schema.sql)
-- =====================================================

-- Additional tags if needed
INSERT INTO admin_tags (name, description) VALUES
  ('秘書', '基金會秘書，可協助處理行政事務')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- TEST DATA: Workflow Templates
-- =====================================================

INSERT INTO workflow_templates (name, description, steps) VALUES
  ('簡易審核流程', '僅需主管審核的簡易流程',
   '[
     {"id": "step-1", "name": "提案", "type": "status"},
     {"id": "step-2", "name": "主管審核", "type": "approval"},
     {"id": "step-3", "name": "執行中", "type": "status"},
     {"id": "step-4", "name": "結案", "type": "status"}
   ]'::JSONB
  ),
  ('成立審核流程', '包含成立審核的流程',
   '[
     {"id": "step-1", "name": "提案", "type": "status"},
     {"id": "step-2", "name": "成立審核", "type": "establishment"},
     {"id": "step-3", "name": "財務審核", "type": "approval"},
     {"id": "step-4", "name": "執行中", "type": "status"},
     {"id": "step-5", "name": "結案", "type": "status"}
   ]'::JSONB
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- TEST DATA: Project Types (already inserted in schema.sql)
-- =====================================================

-- Additional project types if needed
INSERT INTO project_types (name, budget_min, budget_max) VALUES
  ('醫療補助', 5000, 80000),
  ('教育支援', 3000, 40000)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- FUNCTION: Create Initial Admin User
-- =====================================================

-- This function should be called after creating the admin user via Supabase Auth
-- It sets up the profile with admin role and tags

CREATE OR REPLACE FUNCTION setup_initial_admin(
  admin_user_id UUID,
  admin_email VARCHAR,
  admin_name VARCHAR,
  admin_phone VARCHAR
)
RETURNS void AS $$
DECLARE
  v_number VARCHAR(20);
BEGIN
  -- Generate volunteer number
  v_number := generate_volunteer_number('social');

  -- Insert or update profile
  INSERT INTO profiles (
    id, volunteer_number, type, role, name, email, phone, birthday, status
  ) VALUES (
    admin_user_id,
    v_number,
    'social',
    'admin',
    admin_name,
    admin_email,
    admin_phone,
    '1990-01-01',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone;

  -- Assign all admin tags
  INSERT INTO user_admin_tags (user_id, tag_id)
  SELECT admin_user_id, id FROM admin_tags
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Admin user % setup complete with volunteer number %', admin_email, v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Handle New User Registration
-- =====================================================

-- This trigger function creates a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_type volunteer_type;
  v_number VARCHAR(20);
  v_birthday DATE;
  v_age INTEGER;
  v_threshold INTEGER;
BEGIN
  -- Get youth age threshold from settings
  SELECT youth_age_threshold INTO v_threshold FROM system_settings LIMIT 1;
  IF v_threshold IS NULL THEN
    v_threshold := 30;
  END IF;

  -- Default birthday if not provided (will be updated later)
  v_birthday := COALESCE(
    (NEW.raw_user_meta_data->>'birthday')::DATE,
    CURRENT_DATE - INTERVAL '25 years'
  );

  -- Calculate age and determine type
  v_age := DATE_PART('year', AGE(v_birthday));
  IF v_age < v_threshold THEN
    v_type := 'youth';
  ELSE
    v_type := 'social';
  END IF;

  -- Generate volunteer number
  v_number := generate_volunteer_number(v_type);

  -- Create profile
  INSERT INTO profiles (
    id,
    volunteer_number,
    type,
    role,
    name,
    email,
    phone,
    birthday,
    status
  ) VALUES (
    NEW.id,
    v_number,
    v_type,
    'volunteer',
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_birthday,
    'active'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- FUNCTION: Approve Volunteer Application
-- =====================================================

CREATE OR REPLACE FUNCTION approve_volunteer_application(
  application_id UUID,
  reviewer_id UUID,
  note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  app RECORD;
  v_type volunteer_type;
  v_age INTEGER;
  v_threshold INTEGER;
  new_user_id UUID;
BEGIN
  -- Get application
  SELECT * INTO app FROM volunteer_applications WHERE id = application_id;
  IF app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF app.status != 'pending' THEN
    RAISE EXCEPTION 'Application is not pending';
  END IF;

  -- Get youth age threshold
  SELECT youth_age_threshold INTO v_threshold FROM system_settings LIMIT 1;

  -- Calculate age and determine type
  v_age := DATE_PART('year', AGE(app.birthday));
  IF v_age < v_threshold THEN
    v_type := 'youth';
  ELSE
    v_type := 'social';
  END IF;

  -- Update application status
  UPDATE volunteer_applications SET
    status = 'approved',
    review_note = note,
    reviewed_by = reviewer_id,
    reviewed_at = NOW()
  WHERE id = application_id;

  -- Note: The actual user creation should be done via Supabase Auth API
  -- This function just updates the application status
  -- The calling code should:
  -- 1. Create user via supabase.auth.admin.createUser()
  -- 2. The handle_new_user trigger will create the profile

  RETURN application_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get Next Waitlist Position
-- =====================================================

CREATE OR REPLACE FUNCTION get_next_waitlist_position(activity_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(waitlist_position), 0)
  INTO max_position
  FROM activity_registrations
  WHERE activity_id = activity_id_param
    AND status = 'waitlist';

  RETURN max_position + 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Process Activity Registration
-- =====================================================

CREATE OR REPLACE FUNCTION process_activity_registration(
  p_activity_id UUID,
  p_user_id UUID
)
RETURNS activity_registrations AS $$
DECLARE
  v_activity activities;
  v_confirmed_count INTEGER;
  v_registration activity_registrations;
  v_status registration_status;
  v_waitlist_position INTEGER;
BEGIN
  -- Get activity
  SELECT * INTO v_activity FROM activities WHERE id = p_activity_id;
  IF v_activity IS NULL THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  -- Count confirmed registrations
  SELECT COUNT(*) INTO v_confirmed_count
  FROM activity_registrations
  WHERE activity_id = p_activity_id AND status = 'confirmed';

  -- Determine status based on mode and capacity
  IF v_activity.capacity > 0 AND v_confirmed_count >= v_activity.capacity THEN
    -- Activity is full, add to waitlist
    v_status := 'waitlist';
    v_waitlist_position := get_next_waitlist_position(p_activity_id);
  ELSIF v_activity.registration_mode = 'direct' THEN
    -- Direct confirmation
    v_status := 'confirmed';
    v_waitlist_position := NULL;
  ELSE
    -- Needs approval
    v_status := 'pending';
    v_waitlist_position := NULL;
  END IF;

  -- Create registration
  INSERT INTO activity_registrations (
    activity_id, user_id, status, waitlist_position
  ) VALUES (
    p_activity_id, p_user_id, v_status, v_waitlist_position
  )
  RETURNING * INTO v_registration;

  RETURN v_registration;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
