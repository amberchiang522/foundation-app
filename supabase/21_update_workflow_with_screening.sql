-- =====================================================
-- 更新流程：第2步初步篩選為成立審核類型
-- 執行日期: 2026-09-28
-- =====================================================

-- 第一部分：更新 plans 的 workflow
DO $$
DECLARE
  new_workflow JSONB := '[{"id":"step-1","name":"收到申請","type":"status","subTasks":[{"id":"sub-1-1","name":"管道（個人/機構/董事）","completed":false,"note":""}]},{"id":"step-2","name":"初步篩選","type":"establishment","subTasks":[]},{"id":"step-3","name":"評估表・訪視","type":"approval","subTasks":[{"id":"sub-3-1","name":"評估表（預期金額）","completed":false},{"id":"sub-3-2","name":"訪視（機構/董事不用）","completed":false}]},{"id":"step-4","name":"評議委員會","type":"approval","subTasks":[{"id":"sub-4-1","name":"會議日期","completed":false,"note":""}]},{"id":"step-5","name":"寄發通知","type":"approval","subTasks":[{"id":"sub-5-1","name":"寄出通知單","completed":false},{"id":"sub-5-2","name":"收回申請表正本","completed":false},{"id":"sub-5-3","name":"核定通知單","completed":false}]},{"id":"step-6","name":"設定補助・結案","type":"approval","subTasks":[{"id":"sub-6-1","name":"補助期間","completed":false,"note":""},{"id":"sub-6-2","name":"補助金額","completed":false,"note":""}]}]'::JSONB;
BEGIN
  -- 更新 workflow_templates 表
  UPDATE workflow_templates
  SET steps = new_workflow,
      description = '標準公益計畫審核流程（6步驟，含初步篩選）'
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
  step3_status TEXT;
  now_str TEXT;
BEGIN
  now_str := NOW()::TEXT;

  FOR project_record IN SELECT id, workflow FROM projects
  LOOP
    -- 取得來源類型
    source_type := COALESCE(project_record.workflow->0->'subTasks'->0->>'note', '個人');

    -- 決定是否跳過初步篩選
    skip_screening := source_type IN ('機構', '董事');

    IF skip_screening THEN
      start_step := 2;
      step2_status := 'approved';
      step3_status := 'in_progress';
    ELSE
      start_step := 1;
      step2_status := 'in_progress';
      step3_status := 'pending';
    END IF;

    -- 使用 jsonb_build_array 和 jsonb_build_object 建立 workflow
    new_workflow := jsonb_build_array(
      jsonb_build_object(
        'id', 'step-1',
        'name', '收到申請',
        'type', 'status',
        'status', 'approved',
        'approvedAt', now_str,
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-1-1', 'name', '管道（個人/機構/董事）', 'completed', true, 'note', source_type)
        )
      ),
      jsonb_build_object(
        'id', 'step-2',
        'name', '初步篩選',
        'type', 'establishment',
        'status', step2_status,
        'approvedAt', CASE WHEN skip_screening THEN to_jsonb(now_str) ELSE 'null'::jsonb END,
        'subTasks', '[]'::jsonb
      ),
      jsonb_build_object(
        'id', 'step-3',
        'name', '評估表・訪視',
        'type', 'approval',
        'status', step3_status,
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-3-1', 'name', '評估表（預期金額）', 'completed', false),
          jsonb_build_object('id', 'sub-3-2', 'name', '訪視（機構/董事不用）', 'completed', false)
        )
      ),
      jsonb_build_object(
        'id', 'step-4',
        'name', '評議委員會',
        'type', 'approval',
        'status', 'pending',
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-4-1', 'name', '會議日期', 'completed', false, 'note', '')
        )
      ),
      jsonb_build_object(
        'id', 'step-5',
        'name', '寄發通知',
        'type', 'approval',
        'status', 'pending',
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-5-1', 'name', '寄出通知單', 'completed', false),
          jsonb_build_object('id', 'sub-5-2', 'name', '收回申請表正本', 'completed', false),
          jsonb_build_object('id', 'sub-5-3', 'name', '核定通知單', 'completed', false)
        )
      ),
      jsonb_build_object(
        'id', 'step-6',
        'name', '設定補助・結案',
        'type', 'approval',
        'status', 'pending',
        'subTasks', jsonb_build_array(
          jsonb_build_object('id', 'sub-6-1', 'name', '補助期間', 'completed', false, 'note', ''),
          jsonb_build_object('id', 'sub-6-2', 'name', '補助金額', 'completed', false, 'note', '')
        )
      )
    );

    -- 更新專案
    UPDATE projects
    SET workflow = new_workflow,
        current_step = start_step,
        updated_at = NOW()
    WHERE id = project_record.id;
  END LOOP;

  RAISE NOTICE '已更新所有 projects 的 workflow';
END $$;

-- 驗證更新結果
SELECT
  'plans' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE jsonb_array_length(workflow) = 6) as updated_count
FROM plans
UNION ALL
SELECT
  'projects' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE jsonb_array_length(workflow) = 6) as updated_count
FROM projects;
