-- =====================================================
-- 鴻勁公益慈善基金會 - 志工與專案管理系統
-- Part 3: Functions and Triggers
-- =====================================================

-- =====================================================
-- FUNCTION: Handle New User Registration
-- =====================================================

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
  SELECT youth_age_threshold INTO v_threshold FROM public.system_settings LIMIT 1;
  IF v_threshold IS NULL THEN
    v_threshold := 30;
  END IF;

  -- Default birthday if not provided
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
  v_number := public.generate_volunteer_number(v_type);

  -- Create profile
  INSERT INTO public.profiles (
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
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'volunteer'),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_birthday,
    'active'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- FUNCTION: Setup Initial Admin
-- =====================================================

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
    phone = EXCLUDED.phone,
    updated_at = NOW();

  -- Assign all admin tags
  INSERT INTO user_admin_tags (user_id, tag_id)
  SELECT admin_user_id, id FROM admin_tags
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Admin user % setup complete with volunteer number %', admin_email, v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Approve Volunteer Application
-- =====================================================

CREATE OR REPLACE FUNCTION approve_volunteer_application(
  p_application_id UUID,
  p_reviewer_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_app RECORD;
BEGIN
  -- Get application
  SELECT * INTO v_app FROM volunteer_applications WHERE id = p_application_id;
  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.status != 'pending' AND v_app.status != 'needs_revision' THEN
    RAISE EXCEPTION 'Application is not pending';
  END IF;

  -- Update application status
  UPDATE volunteer_applications SET
    status = 'approved',
    review_note = p_note,
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;

  RETURN p_application_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Reject Volunteer Application
-- =====================================================

CREATE OR REPLACE FUNCTION reject_volunteer_application(
  p_application_id UUID,
  p_reviewer_id UUID,
  p_note TEXT
)
RETURNS UUID AS $$
BEGIN
  UPDATE volunteer_applications SET
    status = 'rejected',
    review_note = p_note,
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;

  RETURN p_application_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Request Revision for Application
-- =====================================================

CREATE OR REPLACE FUNCTION request_application_revision(
  p_application_id UUID,
  p_reviewer_id UUID,
  p_note TEXT
)
RETURNS UUID AS $$
BEGIN
  UPDATE volunteer_applications SET
    status = 'needs_revision',
    review_note = p_note,
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;

  RETURN p_application_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get Next Waitlist Position
-- =====================================================

CREATE OR REPLACE FUNCTION get_next_waitlist_position(p_activity_id UUID)
RETURNS INTEGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(waitlist_position), 0)
  INTO max_position
  FROM activity_registrations
  WHERE activity_id = p_activity_id
    AND status = 'waitlist';

  RETURN max_position + 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Process Activity Registration
-- =====================================================

CREATE OR REPLACE FUNCTION register_for_activity(
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

  -- Check if already registered
  IF EXISTS (SELECT 1 FROM activity_registrations WHERE activity_id = p_activity_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Already registered for this activity';
  END IF;

  -- Count confirmed registrations
  SELECT COUNT(*) INTO v_confirmed_count
  FROM activity_registrations
  WHERE activity_id = p_activity_id AND status = 'confirmed';

  -- Determine status based on mode and capacity
  IF v_activity.capacity > 0 AND v_confirmed_count >= v_activity.capacity THEN
    v_status := 'waitlist';
    v_waitlist_position := get_next_waitlist_position(p_activity_id);
  ELSIF v_activity.registration_mode = 'direct' THEN
    v_status := 'confirmed';
    v_waitlist_position := NULL;
  ELSE
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

-- =====================================================
-- FUNCTION: Cancel Registration
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_registration(
  p_registration_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_reg activity_registrations;
  v_next_waitlist activity_registrations;
BEGIN
  -- Get registration
  SELECT * INTO v_reg FROM activity_registrations WHERE id = p_registration_id;
  IF v_reg IS NULL OR v_reg.user_id != p_user_id THEN
    RAISE EXCEPTION 'Registration not found or unauthorized';
  END IF;

  -- Update to cancelled
  UPDATE activity_registrations SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_registration_id;

  -- If was confirmed, promote next waitlist
  IF v_reg.status = 'confirmed' THEN
    SELECT * INTO v_next_waitlist
    FROM activity_registrations
    WHERE activity_id = v_reg.activity_id
      AND status = 'waitlist'
    ORDER BY waitlist_position ASC
    LIMIT 1;

    IF v_next_waitlist IS NOT NULL THEN
      UPDATE activity_registrations SET
        status = 'confirmed',
        waitlist_position = NULL,
        updated_at = NOW()
      WHERE id = v_next_waitlist.id;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Advance Project Workflow
-- =====================================================

CREATE OR REPLACE FUNCTION advance_project_workflow(
  p_project_id UUID,
  p_step_id VARCHAR,
  p_user_id UUID,
  p_approved BOOLEAN,
  p_note TEXT DEFAULT NULL
)
RETURNS projects AS $$
DECLARE
  v_project projects;
  v_workflow JSONB;
  v_step JSONB;
  v_step_index INTEGER;
  v_new_status VARCHAR;
BEGIN
  -- Get project
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  v_workflow := v_project.workflow;

  -- Find step index
  SELECT ordinality - 1 INTO v_step_index
  FROM jsonb_array_elements(v_workflow) WITH ORDINALITY
  WHERE value->>'id' = p_step_id;

  IF v_step_index IS NULL THEN
    RAISE EXCEPTION 'Step not found';
  END IF;

  -- Determine new status
  v_step := v_workflow->v_step_index;
  IF p_approved THEN
    v_new_status := 'approved';
  ELSIF (v_step->>'type') = 'establishment' THEN
    v_new_status := 'not_established';
  ELSE
    v_new_status := 'rejected';
  END IF;

  -- Update step status
  v_workflow := jsonb_set(
    v_workflow,
    ARRAY[v_step_index::TEXT, 'status'],
    to_jsonb(v_new_status)
  );
  v_workflow := jsonb_set(
    v_workflow,
    ARRAY[v_step_index::TEXT, 'approvedBy'],
    to_jsonb(p_user_id::TEXT)
  );
  v_workflow := jsonb_set(
    v_workflow,
    ARRAY[v_step_index::TEXT, 'approvedAt'],
    to_jsonb(NOW()::TEXT)
  );
  IF p_note IS NOT NULL THEN
    v_workflow := jsonb_set(
      v_workflow,
      ARRAY[v_step_index::TEXT, 'note'],
      to_jsonb(p_note)
    );
  END IF;

  -- Update project
  IF p_approved AND v_step_index < jsonb_array_length(v_workflow) - 1 THEN
    -- Advance to next step
    v_workflow := jsonb_set(
      v_workflow,
      ARRAY[(v_step_index + 1)::TEXT, 'status'],
      '"in_progress"'::JSONB
    );
    UPDATE projects SET
      workflow = v_workflow,
      current_step = v_step_index + 1,
      updated_at = NOW()
    WHERE id = p_project_id;
  ELSIF p_approved AND v_step_index = jsonb_array_length(v_workflow) - 1 THEN
    -- Last step completed
    UPDATE projects SET
      workflow = v_workflow,
      status = 'completed',
      updated_at = NOW()
    WHERE id = p_project_id;
  ELSIF v_new_status = 'not_established' THEN
    -- Not established
    UPDATE projects SET
      workflow = v_workflow,
      status = 'not_established',
      updated_at = NOW()
    WHERE id = p_project_id;
  ELSE
    -- Rejected
    UPDATE projects SET
      workflow = v_workflow,
      updated_at = NOW()
    WHERE id = p_project_id;
  END IF;

  -- Return updated project
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  RETURN v_project;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Functions created successfully!';
  RAISE NOTICE 'All database setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'To create initial admin, run:';
  RAISE NOTICE 'SELECT setup_initial_admin(''USER_UUID'', ''email'', ''name'', ''phone'');';
END $$;
