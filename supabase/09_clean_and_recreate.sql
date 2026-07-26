-- =====================================================
-- 完全清除測試帳號
-- =====================================================

-- 先取得要刪除的 user IDs
DO $$
DECLARE
  user_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO user_ids
  FROM auth.users
  WHERE email IN ('b232914712000@gmail.com', 'chen60205822@gmail.com', 'volunteer@test.com');

  IF user_ids IS NOT NULL THEN
    -- 刪除 public schema 相關資料
    DELETE FROM public.user_admin_tags WHERE user_id = ANY(user_ids);
    DELETE FROM public.profiles WHERE id = ANY(user_ids);

    -- 刪除 auth schema 相關資料
    DELETE FROM auth.sessions WHERE user_id = ANY(user_ids);
    DELETE FROM auth.refresh_tokens WHERE user_id::uuid = ANY(user_ids);
    DELETE FROM auth.mfa_factors WHERE user_id = ANY(user_ids);
    DELETE FROM auth.identities WHERE user_id = ANY(user_ids);
    DELETE FROM auth.users WHERE id = ANY(user_ids);

    RAISE NOTICE '✅ 已刪除 % 個帳號', array_length(user_ids, 1);
  ELSE
    RAISE NOTICE '沒有找到要刪除的帳號';
  END IF;
END $$;

-- 清理孤立的 profiles
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);

-- 驗證清除結果
SELECT 'auth.users' as table_name, COUNT(*) as remaining
FROM auth.users
WHERE email IN ('b232914712000@gmail.com', 'chen60205822@gmail.com', 'volunteer@test.com');
