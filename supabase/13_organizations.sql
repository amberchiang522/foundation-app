-- =====================================================
-- 鴻勁公益慈善基金會 - 機構管理模組
-- Part 13: Organizations, Visit Records, Upcoming Visits
-- =====================================================

-- =====================================================
-- CLEAN UP (Drop tables first to avoid type conflicts)
-- =====================================================
DROP TABLE IF EXISTS upcoming_visits CASCADE;
DROP TABLE IF EXISTS visit_records CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- =====================================================
-- ENUM TYPES
-- =====================================================

DROP TYPE IF EXISTS organization_category CASCADE;
DROP TYPE IF EXISTS visit_status CASCADE;

-- 機構類型
CREATE TYPE organization_category AS ENUM ('orphanage', 'association', 'school', 'hospital', 'other');

-- 訪視狀態
CREATE TYPE visit_status AS ENUM ('pending', 'completed', 'cancelled');

-- =====================================================
-- ORGANIZATIONS TABLE (機構表)
-- =====================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  category organization_category NOT NULL DEFAULT 'other',
  contact_person VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  website TEXT,
  line_id VARCHAR(100),
  notes TEXT,

  -- 狀態（軟刪除用）
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- 關聯計畫
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- 審計欄位
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_category ON organizations(category);
CREATE INDEX idx_organizations_project_id ON organizations(project_id);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);
CREATE INDEX idx_organizations_status ON organizations(status);

-- =====================================================
-- VISIT RECORDS TABLE (訪視紀錄表)
-- =====================================================

CREATE TABLE visit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- 訪視資訊
  visit_date DATE NOT NULL,
  visitor_ids UUID[] NOT NULL DEFAULT '{}',
  purpose TEXT,
  content TEXT,

  -- 雙方需求與下一步
  org_requests TEXT,
  foundation_requests TEXT,
  next_steps TEXT,
  progress_update TEXT,

  -- 實際完成時間
  completed_at TIMESTAMPTZ,

  -- 附件（照片、PDF等）
  attachments JSONB DEFAULT '[]',

  -- 審計欄位
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visit_records_org_id ON visit_records(organization_id);
CREATE INDEX idx_visit_records_visit_date ON visit_records(visit_date DESC);
CREATE INDEX idx_visit_records_created_by ON visit_records(created_by);

-- =====================================================
-- UPCOMING VISITS TABLE (待訪視日程表)
-- =====================================================

CREATE TABLE upcoming_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- 預計訪視資訊
  planned_date DATE NOT NULL,
  planned_time TIME,
  purpose TEXT,
  assigned_user_ids UUID[] NOT NULL DEFAULT '{}',

  -- 狀態
  status visit_status NOT NULL DEFAULT 'pending',
  notes TEXT,

  -- 審計欄位
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upcoming_visits_org_id ON upcoming_visits(organization_id);
CREATE INDEX idx_upcoming_visits_planned_date ON upcoming_visits(planned_date);
CREATE INDEX idx_upcoming_visits_status ON upcoming_visits(status);
CREATE INDEX idx_upcoming_visits_created_by ON upcoming_visits(created_by);

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER visit_records_updated_at
  BEFORE UPDATE ON visit_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER upcoming_visits_updated_at
  BEFORE UPDATE ON upcoming_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE upcoming_visits ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Admin can manage organizations" ON organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Volunteers can view organizations" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Visit records policies
CREATE POLICY "Admin can manage visit_records" ON visit_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Volunteers can view visit_records" ON visit_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Upcoming visits policies
CREATE POLICY "Admin can manage upcoming_visits" ON upcoming_visits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Volunteers can view upcoming_visits" ON upcoming_visits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Organizations module created successfully!';
END $$;
