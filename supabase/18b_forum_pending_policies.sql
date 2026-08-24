-- =====================================================
-- 步驟 2：更新 RLS 政策
-- 請先執行 18a_forum_add_pending_enum.sql
-- =====================================================

-- 更新 RLS 政策：只有審核通過的討論才公開
DROP POLICY IF EXISTS "Active posts are public" ON forum_posts;
CREATE POLICY "Approved posts are public" ON forum_posts
  FOR SELECT USING (status = 'active');

-- 用戶可以看到自己的待審核討論
DROP POLICY IF EXISTS "Users can see own pending posts" ON forum_posts;
CREATE POLICY "Users can see own pending posts" ON forum_posts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND status = 'pending');

-- 管理員可以看到所有討論（包含待審核）
DROP POLICY IF EXISTS "Admins can see all posts" ON forum_posts;
CREATE POLICY "Admins can see all posts" ON forum_posts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- 管理員可以更新所有討論（審核）
DROP POLICY IF EXISTS "Admins can update posts" ON forum_posts;
CREATE POLICY "Admins can update posts" ON forum_posts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
