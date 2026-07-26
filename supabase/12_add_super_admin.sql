-- =====================================================
-- 新增超級管理員角色
-- =====================================================

-- 1. 修改 user_role ENUM 類型，新增 super_admin
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. 將 b232914712000@gmail.com 設為 super_admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'b232914712000@gmail.com';

-- 3. 更新 is_admin 函數，包含 super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- 4. 新增 is_super_admin 函數
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 5. 更新 profiles RLS 政策，讓 super_admin 可以更改角色
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

-- 一般管理員可以更新 profiles（但不能改角色）
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (
    public.is_admin() AND (
      -- super_admin 可以改任何欄位
      public.is_super_admin() OR
      -- 一般 admin 不能改 role 欄位（透過確保 role 不變）
      role = (SELECT role FROM public.profiles WHERE id = profiles.id)
    )
  );

-- 6. 新增 super_admin 專用政策
CREATE POLICY "profiles_update_role_super_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 7. 更新 user_admin_tags RLS，讓 super_admin 可以管理所有標籤
DROP POLICY IF EXISTS "user_admin_tags_admin" ON public.user_admin_tags;

CREATE POLICY "user_admin_tags_manage_super_admin" ON public.user_admin_tags
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "user_admin_tags_manage_admin" ON public.user_admin_tags
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8. 驗證
SELECT
  p.email,
  p.name,
  p.role,
  CASE WHEN p.role = 'super_admin' THEN '✅ 超級管理員' ELSE '' END as status
FROM public.profiles p
WHERE p.role IN ('admin', 'super_admin')
ORDER BY p.role DESC;
