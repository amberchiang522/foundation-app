-- =====================================================
-- 添加付款記錄欄位到 projects 表
-- paymentRecords: 用於追蹤一次性和期間性付款狀態
-- =====================================================

-- 添加 payment_records 欄位
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS payment_records JSONB DEFAULT NULL;

-- 為 payment_records 添加索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_projects_payment_records
ON projects USING GIN (payment_records);

-- 添加註解
COMMENT ON COLUMN projects.payment_records IS '付款記錄：oneTimePaid (一次性是否付款), oneTimePaidAt (付款時間), periodicPayments (期間性付款陣列)';
