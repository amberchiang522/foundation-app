-- =====================================================
-- 完整修復 Auth 帳號 - 確保所有必要欄位正確
-- =====================================================

-- 首先查看現有使用者的完整資料
SELECT * FROM auth.users WHERE email = 'b232914712000@gmail.com';

-- =====================================================
-- 修復管理員帳號的所有欄位
-- =====================================================

UPDATE auth.users
SET
  instance_id = '00000000-0000-0000-0000-000000000000',
  aud = 'authenticated',
  role = 'authenticated',
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  encrypted_password = crypt('0963663073', gen_salt('bf', 10)),
  raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
  raw_user_meta_data = '{"name": "系統管理員"}'::jsonb,
  is_super_admin = false,
  is_sso_user = false,
  banned_until = NULL,
  deleted_at = NULL,
  is_anonymous = false,
  updated_at = NOW()
WHERE id = '18082acc-168f-4e8f-990a-8f856fc70c48';

-- =====================================================
-- 修復志工帳號的所有欄位
-- =====================================================

UPDATE auth.users
SET
  instance_id = '00000000-0000-0000-0000-000000000000',
  aud = 'authenticated',
  role = 'authenticated',
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  encrypted_password = crypt('0912345678', gen_salt('bf', 10)),
  raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
  raw_user_meta_data = '{"name": "測試志工"}'::jsonb,
  is_super_admin = false,
  is_sso_user = false,
  banned_until = NULL,
  deleted_at = NULL,
  is_anonymous = false,
  updated_at = NOW()
WHERE id = '0cf012ed-c757-46b9-ba9b-ebd14d8856da';

-- =====================================================
-- 確保 identities 存在且正確
-- =====================================================

-- 刪除現有的 identities
DELETE FROM auth.identities
WHERE user_id IN ('18082acc-168f-4e8f-990a-8f856fc70c48', '0cf012ed-c757-46b9-ba9b-ebd14d8856da');

-- 重新建立管理員 identity
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '18082acc-168f-4e8f-990a-8f856fc70c48',
  '18082acc-168f-4e8f-990a-8f856fc70c48',
  '18082acc-168f-4e8f-990a-8f856fc70c48',
  'email',
  jsonb_build_object(
    'sub', '18082acc-168f-4e8f-990a-8f856fc70c48',
    'email', 'b232914712000@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  NOW(),
  NOW(),
  NOW()
);

-- 重新建立志工 identity
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
  '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
  '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
  'email',
  jsonb_build_object(
    'sub', '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
    'email', 'chen60205822@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  NOW(),
  NOW(),
  NOW()
);

-- =====================================================
-- 驗證修復結果
-- =====================================================

SELECT
  u.id,
  u.email,
  u.aud,
  u.role,
  u.email_confirmed_at IS NOT NULL as email_confirmed,
  u.confirmed_at IS NOT NULL as confirmed,
  u.encrypted_password IS NOT NULL as has_password,
  u.is_sso_user,
  u.deleted_at IS NULL as not_deleted
FROM auth.users u
WHERE u.id IN ('18082acc-168f-4e8f-990a-8f856fc70c48', '0cf012ed-c757-46b9-ba9b-ebd14d8856da');

SELECT
  i.user_id,
  i.provider,
  i.provider_id,
  i.identity_data->>'email' as email
FROM auth.identities i
WHERE i.user_id IN ('18082acc-168f-4e8f-990a-8f856fc70c48', '0cf012ed-c757-46b9-ba9b-ebd14d8856da');
