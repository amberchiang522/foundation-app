-- =====================================================
-- 修復測試帳號密碼 - 只更新 auth 相關資料
-- =====================================================

-- 管理員帳號
-- ID: 18082acc-168f-4e8f-990a-8f856fc70c48
-- Email: b232914712000@gmail.com
-- Password: 0963663073

-- 志工帳號
-- ID: 0cf012ed-c757-46b9-ba9b-ebd14d8856da
-- Email: chen60205822@gmail.com
-- Password: 0912345678

-- =====================================================
-- 更新管理員密碼
-- =====================================================

UPDATE auth.users
SET
  encrypted_password = crypt('0963663073', gen_salt('bf', 10)),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE id = '18082acc-168f-4e8f-990a-8f856fc70c48';

-- 確保 identity 存在
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
  '18082acc-168f-4e8f-990a-8f856fc70c48',
  '18082acc-168f-4e8f-990a-8f856fc70c48',
  jsonb_build_object(
    'sub', '18082acc-168f-4e8f-990a-8f856fc70c48',
    'email', 'b232914712000@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  '18082acc-168f-4e8f-990a-8f856fc70c48',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider, provider_id) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = NOW();

-- =====================================================
-- 更新志工密碼
-- =====================================================

UPDATE auth.users
SET
  encrypted_password = crypt('0912345678', gen_salt('bf', 10)),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE id = '0cf012ed-c757-46b9-ba9b-ebd14d8856da';

-- 確保 identity 存在
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
  '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
  '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
  jsonb_build_object(
    'sub', '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
    'email', 'chen60205822@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  '0cf012ed-c757-46b9-ba9b-ebd14d8856da',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider, provider_id) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = NOW();

-- =====================================================
-- 驗證結果
-- =====================================================

SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmed,
  u.encrypted_password IS NOT NULL as has_password,
  i.provider IS NOT NULL as has_identity,
  p.name,
  p.role
FROM auth.users u
LEFT JOIN auth.identities i ON u.id = i.user_id
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.id IN (
  '18082acc-168f-4e8f-990a-8f856fc70c48',
  '0cf012ed-c757-46b9-ba9b-ebd14d8856da'
);
