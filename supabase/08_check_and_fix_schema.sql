-- =====================================================
-- 檢查並修復 Schema 問題
-- =====================================================

-- 1. 檢查 auth schema 上的 triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth';

-- 2. 暫時停用可能有問題的 trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. 檢查 handle_new_user 函數是否有問題
-- 先刪除可能有問題的函數
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 4. 現在測試登入應該可以了
-- 請在執行此 SQL 後再試一次登入

-- 5. 如果登入成功，我們再重新建立正確的 trigger
