-- =====================================================
-- 步驟 1：新增 pending 狀態到 enum
-- 執行完這個後，再執行 18b_forum_pending_policies.sql
-- =====================================================

ALTER TYPE forum_post_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'active';
