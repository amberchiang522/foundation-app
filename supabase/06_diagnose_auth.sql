-- =====================================================
-- 診斷 Auth Schema 問題
-- =====================================================

-- 1. 檢查必要的擴展
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgcrypto', 'uuid-ossp', 'pgjwt');

-- 2. 檢查 auth schema 是否存在
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';

-- 3. 檢查 auth.users 表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- 4. 檢查測試使用者資料
SELECT
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at,
  instance_id,
  aud,
  role,
  raw_app_meta_data,
  created_at
FROM auth.users
WHERE email IN ('b232914712000@gmail.com', 'chen60205822@gmail.com');

-- 5. 檢查 auth.identities
SELECT
  id,
  user_id,
  provider,
  provider_id,
  identity_data
FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('b232914712000@gmail.com', 'chen60205822@gmail.com')
);

-- 6. 檢查 instance_id (這很重要!)
SELECT DISTINCT instance_id FROM auth.users LIMIT 5;
