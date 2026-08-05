-- =====================================================
-- 15. 連結志工申請與帳號註冊
-- =====================================================
-- 當創建帳號時，自動對應已審核通過的志工申請
-- 有對應 → volunteer（志工）
-- 沒對應 → staff（內部人員）

-- 1. 新增 staff 角色
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. 更新 handle_new_user 函數
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_application RECORD;
  v_type volunteer_type;
  v_number VARCHAR(20);
  v_birthday DATE;
  v_age INTEGER;
  v_threshold INTEGER;
  v_name VARCHAR(100);
  v_phone VARCHAR(20);
  v_occupation VARCHAR(100);
  v_experience TEXT;
  v_line_id VARCHAR(100);
  v_role user_role;
  v_is_volunteer BOOLEAN;
BEGIN
  -- Get youth age threshold from settings
  SELECT youth_age_threshold INTO v_threshold FROM system_settings LIMIT 1;
  IF v_threshold IS NULL THEN
    v_threshold := 30;
  END IF;

  -- 查找是否有已審核通過的志工申請（用 email 對應）
  SELECT * INTO v_application
  FROM volunteer_applications
  WHERE email = NEW.email
    AND status = 'approved'
  ORDER BY reviewed_at DESC
  LIMIT 1;

  IF v_application IS NOT NULL THEN
    -- ✅ 有對應的申請 → 成為志工
    v_is_volunteer := TRUE;
    v_role := 'volunteer';
    v_birthday := v_application.birthday;
    v_name := v_application.name;
    v_phone := v_application.phone;
    v_occupation := v_application.occupation;
    v_experience := v_application.experience;
    v_line_id := v_application.line_id;
  ELSE
    -- ❌ 沒有對應的申請 → 成為內部人員 (staff)
    v_is_volunteer := FALSE;
    v_role := 'staff';
    v_birthday := COALESCE(
      (NEW.raw_user_meta_data->>'birthday')::DATE,
      CURRENT_DATE - INTERVAL '25 years'
    );
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
    v_occupation := NULL;
    v_experience := NULL;
    v_line_id := NULL;
  END IF;

  -- 只有志工才需要計算類型和編號
  IF v_is_volunteer THEN
    v_age := DATE_PART('year', AGE(v_birthday));
    IF v_age < v_threshold THEN
      v_type := 'youth';
    ELSE
      v_type := 'social';
    END IF;
    v_number := generate_volunteer_number(v_type);
  ELSE
    -- 內部人員不需要志工類型和編號
    v_type := 'social';  -- 預設值，不影響
    v_number := NULL;
  END IF;

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
    occupation,
    experience,
    line_id,
    status
  ) VALUES (
    NEW.id,
    v_number,        -- 志工有編號，內部人員為 NULL
    v_type,
    v_role,          -- volunteer 或 staff
    v_name,
    NEW.email,
    v_phone,
    v_birthday,
    v_occupation,
    v_experience,
    v_line_id,
    'active'
  );

  -- 如果有對應的申請，標記帳號已創建
  IF v_application IS NOT NULL THEN
    UPDATE volunteer_applications
    SET review_note = COALESCE(review_note, '') || ' [帳號已創建: ' || NOW()::TEXT || ']'
    WHERE id = v_application.id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 確保 trigger 存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 驗證
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ handle_new_user 函數已更新！';
  RAISE NOTICE '現在創建帳號時會自動對應已審核通過的志工申請';
END $$;
