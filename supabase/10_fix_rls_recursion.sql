-- =====================================================
-- 修復 RLS 無限遞迴問題
-- =====================================================

-- 1. 先刪除有問題的 is_admin 函數
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 2. 重新建立 is_admin 函數，使用 SECURITY DEFINER 繞過 RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 3. 刪除所有 profiles 表的 RLS 政策
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;

-- 4. 重新建立簡化的 RLS 政策（避免遞迴）
-- 用戶可以查看自己的 profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- 用戶可以更新自己的 profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 管理員可以查看所有 profiles（使用 SECURITY DEFINER 函數）
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- 管理員可以執行所有操作
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE
  USING (public.is_admin());

-- 5. 確認 RLS 已啟用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. 驗證政策
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
