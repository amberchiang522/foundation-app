-- =====================================================
-- 建立測試帳號 (Admin & Volunteer)
-- 在 Supabase SQL Editor 執行此腳本
-- =====================================================

-- 確保 pgcrypto 擴展已啟用（用於密碼加密）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. 建立管理員帳號
-- =====================================================

DO $$
DECLARE
  admin_uid UUID := gen_random_uuid();
  admin_email TEXT := 'b232914712000@gmail.com';
  admin_password TEXT := '0963663073';
  admin_encrypted_password TEXT;
BEGIN
  -- 檢查是否已存在
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    RAISE NOTICE '管理員帳號已存在，跳過建立';
    -- 取得現有的 UUID
    SELECT id INTO admin_uid FROM auth.users WHERE email = admin_email;
  ELSE
    -- 加密密碼 (bcrypt)
    admin_encrypted_password := crypt(admin_password, gen_salt('bf'));

    -- 插入 auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      admin_email,
      admin_encrypted_password,
      NOW(), -- 已確認 email
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('name', '系統管理員', 'phone', '0963663073'),
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      '',
      ''
    );

    -- 插入 auth.identities (必要，否則無法登入)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', admin_email),
      'email',
      admin_uid::text,
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE '✅ 管理員帳號建立成功: %', admin_email;
  END IF;

  -- 建立或更新 profile
  INSERT INTO public.profiles (
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
    status
  ) VALUES (
    admin_uid,
    'S-001',
    'social',
    'admin',
    '系統管理員',
    admin_email,
    '0963663073',
    '1990-01-01',
    '基金會管理',
    '系統管理經驗',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    name = '系統管理員',
    updated_at = NOW();

  -- 賦予所有管理員標籤
  INSERT INTO public.user_admin_tags (user_id, tag_id)
  SELECT admin_uid, id FROM public.admin_tags
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ 管理員 Profile 設定完成';
END $$;

-- =====================================================
-- 2. 建立測試志工帳號
-- =====================================================

DO $$
DECLARE
  volunteer_uid UUID := gen_random_uuid();
  volunteer_email TEXT := 'volunteer@test.com';
  volunteer_password TEXT := '0912345678';
  volunteer_encrypted_password TEXT;
BEGIN
  -- 檢查是否已存在
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = volunteer_email) THEN
    RAISE NOTICE '測試志工帳號已存在，跳過建立';
    SELECT id INTO volunteer_uid FROM auth.users WHERE email = volunteer_email;
  ELSE
    -- 加密密碼
    volunteer_encrypted_password := crypt(volunteer_password, gen_salt('bf'));

    -- 插入 auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      volunteer_uid,
      '00000000-0000-0000-0000-000000000000',
      volunteer_email,
      volunteer_encrypted_password,
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('name', '測試志工', 'phone', '0912345678'),
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      '',
      ''
    );

    -- 插入 auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      volunteer_uid,
      jsonb_build_object('sub', volunteer_uid::text, 'email', volunteer_email),
      'email',
      volunteer_uid::text,
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE '✅ 測試志工帳號建立成功: %', volunteer_email;
  END IF;

  -- 建立 profile
  INSERT INTO public.profiles (
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
    volunteer_uid,
    'Y-001',
    'youth',
    'volunteer',
    '測試志工',
    volunteer_email,
    '0912345678',
    '2000-05-15',
    '學生',
    '社區服務經驗',
    'test_line_id',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = '測試志工',
    updated_at = NOW();

  RAISE NOTICE '✅ 測試志工 Profile 設定完成';
END $$;

-- =====================================================
-- 3. 驗證結果
-- =====================================================

-- 顯示建立的帳號
SELECT
  u.email,
  p.name,
  p.role,
  p.volunteer_number,
  p.type as volunteer_type,
  p.status
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
ORDER BY p.role DESC;

-- =====================================================
-- 測試帳號資訊
-- =====================================================
/*
┌─────────────────────────────────────────────────────┐
│ 管理員帳號                                           │
│ Email: b232914712000@gmail.com                      │
│ Password: 0963663073                                │
├─────────────────────────────────────────────────────┤
│ 測試志工帳號                                         │
│ Email: volunteer@test.com                           │
│ Password: 0912345678                                │
└─────────────────────────────────────────────────────┘
*/
