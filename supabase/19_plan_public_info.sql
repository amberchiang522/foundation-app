-- =====================================================
-- 計畫公開資訊表（獨立於內部計畫資料）
-- Migration: 19_plan_public_info.sql
-- =====================================================

-- 建立公開計畫資訊表
CREATE TABLE IF NOT EXISTS plan_public_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID UNIQUE REFERENCES plans(id) ON DELETE CASCADE,

  -- 公開資訊
  name VARCHAR(200) NOT NULL,
  card_description TEXT,           -- 首頁卡片簡介
  public_description TEXT,         -- 詳細介紹文字
  cover_image JSONB,               -- 封面圖
  intro_pdf JSONB,                 -- 介紹 PDF
  download_pdfs JSONB DEFAULT '[]', -- 可下載的 PDF 列表
  display_order INTEGER DEFAULT 0,  -- 顯示順序

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_plan_public_info_plan_id ON plan_public_info(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_public_info_active ON plan_public_info(is_active);
CREATE INDEX IF NOT EXISTS idx_plan_public_info_order ON plan_public_info(display_order);

-- 自動更新 updated_at
DROP TRIGGER IF EXISTS plan_public_info_updated_at ON plan_public_info;
CREATE TRIGGER plan_public_info_updated_at
  BEFORE UPDATE ON plan_public_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- RLS 政策
-- =====================================================

ALTER TABLE plan_public_info ENABLE ROW LEVEL SECURITY;

-- 所有人都可以讀取已啟用的公開資訊
DROP POLICY IF EXISTS "Anyone can read active public info" ON plan_public_info;
CREATE POLICY "Anyone can read active public info" ON plan_public_info
  FOR SELECT USING (is_active = true);

-- 管理員可以完整存取
DROP POLICY IF EXISTS "Admins can manage public info" ON plan_public_info;
CREATE POLICY "Admins can manage public info" ON plan_public_info
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- =====================================================
-- 從現有 plans 表遷移公開資料（如果有的話）
-- =====================================================

-- 將已設定為公開的計畫資料遷移到新表
INSERT INTO plan_public_info (plan_id, name, card_description, public_description, cover_image, intro_pdf, download_pdfs, display_order, is_active)
SELECT
  id,
  name,
  card_description,
  public_description,
  cover_image,
  intro_pdf,
  download_pdfs,
  COALESCE(public_order, 0),
  COALESCE(is_public, false)
FROM plans
WHERE is_public = true
ON CONFLICT (plan_id) DO NOTHING;
