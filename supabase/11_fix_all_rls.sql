-- =====================================================
-- 修復所有資料表的 RLS 政策
-- =====================================================

-- 確保 is_admin 函數存在且使用 SECURITY DEFINER
-- 包含 admin 和 super_admin 兩種角色
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

-- =====================================================
-- Activities RLS
-- =====================================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select_all" ON activities;
DROP POLICY IF EXISTS "activities_insert_admin" ON activities;
DROP POLICY IF EXISTS "activities_update_admin" ON activities;
DROP POLICY IF EXISTS "activities_delete_admin" ON activities;

-- 所有人可以查看活動
CREATE POLICY "activities_select_all" ON activities
  FOR SELECT USING (true);

-- 只有管理員可以新增/修改/刪除
CREATE POLICY "activities_insert_admin" ON activities
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "activities_update_admin" ON activities
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "activities_delete_admin" ON activities
  FOR DELETE USING (public.is_admin());

-- =====================================================
-- Activity Registrations RLS
-- =====================================================
ALTER TABLE activity_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registrations_select_own" ON activity_registrations;
DROP POLICY IF EXISTS "registrations_select_admin" ON activity_registrations;
DROP POLICY IF EXISTS "registrations_insert_own" ON activity_registrations;
DROP POLICY IF EXISTS "registrations_update_own" ON activity_registrations;
DROP POLICY IF EXISTS "registrations_update_admin" ON activity_registrations;

-- 用戶可以查看自己的報名
CREATE POLICY "registrations_select_own" ON activity_registrations
  FOR SELECT USING (user_id = auth.uid());

-- 管理員可以查看所有報名
CREATE POLICY "registrations_select_admin" ON activity_registrations
  FOR SELECT USING (public.is_admin());

-- 用戶可以報名活動
CREATE POLICY "registrations_insert_own" ON activity_registrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 用戶可以取消自己的報名
CREATE POLICY "registrations_update_own" ON activity_registrations
  FOR UPDATE USING (user_id = auth.uid());

-- 管理員可以更新所有報名
CREATE POLICY "registrations_update_admin" ON activity_registrations
  FOR UPDATE USING (public.is_admin());

-- =====================================================
-- Plans RLS
-- =====================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_select_all" ON plans;
DROP POLICY IF EXISTS "plans_insert_admin" ON plans;
DROP POLICY IF EXISTS "plans_update_admin" ON plans;
DROP POLICY IF EXISTS "plans_delete_admin" ON plans;

-- 登入用戶可以查看計畫
CREATE POLICY "plans_select_all" ON plans
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 只有管理員可以新增/修改/刪除
CREATE POLICY "plans_insert_admin" ON plans
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "plans_update_admin" ON plans
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "plans_delete_admin" ON plans
  FOR DELETE USING (public.is_admin());

-- =====================================================
-- Projects RLS
-- =====================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_all" ON projects;
DROP POLICY IF EXISTS "projects_insert_admin" ON projects;
DROP POLICY IF EXISTS "projects_update_admin" ON projects;
DROP POLICY IF EXISTS "projects_delete_admin" ON projects;

-- 登入用戶可以查看專案
CREATE POLICY "projects_select_all" ON projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 只有管理員可以新增/修改/刪除
CREATE POLICY "projects_insert_admin" ON projects
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "projects_update_admin" ON projects
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "projects_delete_admin" ON projects
  FOR DELETE USING (public.is_admin());

-- =====================================================
-- Project Types RLS
-- =====================================================
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_types_select_all" ON project_types;
DROP POLICY IF EXISTS "project_types_admin" ON project_types;

-- 所有人可以查看專案類型
CREATE POLICY "project_types_select_all" ON project_types
  FOR SELECT USING (true);

-- 只有管理員可以修改
CREATE POLICY "project_types_admin" ON project_types
  FOR ALL USING (public.is_admin());

-- =====================================================
-- Workflow Templates RLS
-- =====================================================
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_templates_select_all" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_admin" ON workflow_templates;

-- 登入用戶可以查看
CREATE POLICY "workflow_templates_select_all" ON workflow_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 只有管理員可以修改
CREATE POLICY "workflow_templates_admin" ON workflow_templates
  FOR ALL USING (public.is_admin());

-- =====================================================
-- Volunteer Applications RLS
-- =====================================================
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_insert_anon" ON volunteer_applications;
DROP POLICY IF EXISTS "applications_select_own" ON volunteer_applications;
DROP POLICY IF EXISTS "applications_select_admin" ON volunteer_applications;
DROP POLICY IF EXISTS "applications_update_own" ON volunteer_applications;
DROP POLICY IF EXISTS "applications_update_admin" ON volunteer_applications;

-- 任何人都可以提交申請（匿名）
CREATE POLICY "applications_insert_anon" ON volunteer_applications
  FOR INSERT WITH CHECK (true);

-- 用戶可以用 token 查詢自己的申請
CREATE POLICY "applications_select_by_token" ON volunteer_applications
  FOR SELECT USING (true);  -- Token 查詢在 service 層處理

-- 管理員可以查看所有申請
CREATE POLICY "applications_select_admin" ON volunteer_applications
  FOR SELECT USING (public.is_admin());

-- 管理員可以更新申請
CREATE POLICY "applications_update_admin" ON volunteer_applications
  FOR UPDATE USING (public.is_admin());

-- =====================================================
-- Admin Tags RLS
-- =====================================================
ALTER TABLE admin_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_tags_select_all" ON admin_tags;
DROP POLICY IF EXISTS "admin_tags_admin" ON admin_tags;

-- 登入用戶可以查看
CREATE POLICY "admin_tags_select_all" ON admin_tags
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 只有管理員可以修改
CREATE POLICY "admin_tags_admin" ON admin_tags
  FOR ALL USING (public.is_admin());

-- =====================================================
-- User Admin Tags RLS
-- =====================================================
ALTER TABLE user_admin_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_admin_tags_select" ON user_admin_tags;
DROP POLICY IF EXISTS "user_admin_tags_admin" ON user_admin_tags;

-- 用戶可以查看自己的標籤，管理員可以查看所有
CREATE POLICY "user_admin_tags_select" ON user_admin_tags
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- 只有管理員可以修改
CREATE POLICY "user_admin_tags_admin" ON user_admin_tags
  FOR ALL USING (public.is_admin());

-- =====================================================
-- System Settings RLS
-- =====================================================
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_select" ON system_settings;
DROP POLICY IF EXISTS "system_settings_admin" ON system_settings;

-- 登入用戶可以查看
CREATE POLICY "system_settings_select" ON system_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 只有管理員可以修改
CREATE POLICY "system_settings_admin" ON system_settings
  FOR ALL USING (public.is_admin());

-- =====================================================
-- 驗證
-- =====================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
