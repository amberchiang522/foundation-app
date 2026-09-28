-- =====================================================
-- 更新流程：步驟2改為「評估表」含評核項目
-- 新增計畫代號欄位
-- =====================================================

-- 新增計畫代號欄位
ALTER TABLE plans ADD COLUMN IF NOT EXISTS code VARCHAR(20);

-- 新增專案編號欄位
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_number VARCHAR(50);

-- 第一部分：更新 plans 的 workflow
DO $$
DECLARE
  new_workflow JSONB := '[{"id":"step-1","name":"審核","type":"establishment","requireAttachment":true,"subTasks":[]},{"id":"step-2","name":"評估表","type":"approval","subTasks":[{"id":"sub-2-1","name":"經濟狀況（25分）","completed":false,"note":""},{"id":"sub-2-2","name":"家庭支持情形（20分）","completed":false,"note":""},{"id":"sub-2-3","name":"健康狀況（15分）","completed":false,"note":""},{"id":"sub-2-4","name":"基本生活需求（15分）","completed":false,"note":""},{"id":"sub-2-5","name":"外部資源取得情形（10分）","completed":false,"note":""},{"id":"sub-2-6","name":"文件完整性（5分）","completed":false,"note":""},{"id":"sub-2-7","name":"綜合評估（10分）","completed":false,"note":""}]},{"id":"step-3","name":"評議委員會","type":"approval","subTasks":[{"id":"sub-3-1","name":"會議日期","completed":false,"note":""}]},{"id":"step-4","name":"文件寄發及簽核","type":"approval","subTasks":[{"id":"sub-4-1","name":"寄出通知單","completed":false},{"id":"sub-4-2","name":"收回申請表正本","completed":false},{"id":"sub-4-3","name":"核定通知單","completed":false}]},{"id":"step-5","name":"結案","type":"approval","subTasks":[{"id":"sub-5-1","name":"補助期間","completed":false,"note":""},{"id":"sub-5-2","name":"補助金額","completed":false,"note":""}]}]'::JSONB;
BEGIN
  -- 更新 workflow_templates 表
  UPDATE workflow_templates
  SET steps = new_workflow,
      description = '標準公益計畫審核流程（5步驟，含評估表）'
  WHERE name = '標準審核流程';

  -- 更新所有 plans 的 workflow
  UPDATE plans
  SET workflow = new_workflow,
      updated_at = NOW();

  RAISE NOTICE '已更新所有 plans 的 workflow';
END $$;

-- 第二部分：更新 projects 的 workflow
DO $$
DECLARE
  project_record RECORD;
  source_type TEXT;
  skip_screening BOOLEAN;
  start_step INTEGER;
  new_workflow JSONB;
  step1_status TEXT;
  step2_status TEXT;
  now_str TEXT;
BEGIN
  now_str := NOW()::TEXT;

  FOR project_record IN SELECT id, description, organization_id FROM projects
  LOOP
    -- 從 description 取得來源類型
    source_type := COALESCE(project_record.description, '個人');
    IF source_type NOT IN ('個人', '機構', '董事') THEN
      IF project_record.organization_id IS NOT NULL THEN
        source_type := '機構';
      ELSE
        source_type := '個人';
      END IF;
    END IF;

    -- 決定是否跳過審核
    skip_screening := source_type IN ('機構', '董事');

    IF skip_screening THEN
      start_step := 1;
      step1_status := 'approved';
      step2_status := 'in_progress';
    ELSE
      start_step := 0;
      step1_status := 'in_progress';
      step2_status := 'pending';
    END IF;

    -- 建立新的 5 步驟 workflow
    new_workflow := jsonb_build_array(
      jsonb_build_object(
        'id', 'step-1',
        'name', '審核',
        'type', 'establishment',
        'requireAttachment', true,
        'status', step1_status,
        'approvedAt', CASE WHEN skip_screening THEN now_str ELSE NULL END,
        'subTasks', '[]'::jsonb
      ),
      jsonb_build_object(
        'id', 'step-2',
        'name', '評估表',
        'type', 'approval',
        'status', step2_status,
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-2-1', 'name', '經濟狀況（25分）', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-2-2', 'name', '家庭支持情形（20分）', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-2-3', 'name', '健康狀況（15分）', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-2-4', 'name', '基本生活需求（15分）', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-2-5', 'name', '外部資源取得情形（10分）', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-2-6', 'name', '文件完整性（5分）', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-2-7', 'name', '綜合評估（10分）', 'completed', false, 'note', '')
        )
      ),
      jsonb_build_object(
        'id', 'step-3',
        'name', '評議委員會',
        'type', 'approval',
        'status', 'pending',
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-3-1', 'name', '會議日期', 'completed', false, 'note', '')
        )
      ),
      jsonb_build_object(
        'id', 'step-4',
        'name', '文件寄發及簽核',
        'type', 'approval',
        'status', 'pending',
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-4-1', 'name', '寄出通知單', 'completed', false),
          jsonb_build_object('id', 'sub-4-2', 'name', '收回申請表正本', 'completed', false),
          jsonb_build_object('id', 'sub-4-3', 'name', '核定通知單', 'completed', false)
        )
      ),
      jsonb_build_object(
        'id', 'step-5',
        'name', '結案',
        'type', 'approval',
        'status', 'pending',
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-5-1', 'name', '補助期間', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-5-2', 'name', '補助金額', 'completed', false, 'note', '')
        )
      )
    );

    -- 更新專案，保留來源類型
    UPDATE projects
    SET workflow = new_workflow,
        current_step = start_step,
        description = source_type,
        updated_at = NOW()
    WHERE id = project_record.id;
  END LOOP;

  RAISE NOTICE '已更新所有 projects 的 workflow';
END $$;

-- 驗證更新結果
SELECT 'workflow_updated' as status, COUNT(*) as count FROM projects WHERE jsonb_array_length(workflow) = 5;
