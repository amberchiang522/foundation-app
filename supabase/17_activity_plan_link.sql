-- =====================================================
-- 活動關聯計畫與活動回顧 plan_id 改為可選
-- Migration: 17_activity_plan_link.sql
-- =====================================================

-- 1. 新增 activities 的 plan_id 欄位
ALTER TABLE activities ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;

-- Index for activities by plan
CREATE INDEX IF NOT EXISTS idx_activities_plan ON activities(plan_id) WHERE plan_id IS NOT NULL;

-- 2. 修改 event_reviews 的 plan_id 為可選
ALTER TABLE event_reviews ALTER COLUMN plan_id DROP NOT NULL;
