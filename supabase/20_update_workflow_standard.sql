-- =====================================================
-- 更新所有計畫和專案的流程為標準流程
-- 執行日期: 2026-09-27
-- =====================================================

-- 新標準流程定義 (6步驟)
-- 1. 收到申請 - 建檔，填入管道（個人、機構、董事）
-- 2. 初步篩選 - 個人要篩選，不通過填原因；董事/機構通常直接通過
-- 3. 評估表・訪視 - 評估表（預期金額，全部都要）、訪視（機構/董事不用）
-- 4. 評議委員會 - 填入日期，可以做分類
-- 5. 寄發通知 - 寄出通知單、收回申請表正本內容、核定通知單
-- 6. 設定補助・結案 - 設定補助期間跟金額

-- 定義新的標準流程 JSON
DO $$
DECLARE
  new_workflow JSONB := '[
    {
      "id": "step-1",
      "name": "收到申請",
      "type": "status",
      "subTasks": [
        {"id": "sub-1-1", "name": "管道（個人/機構/董事）", "completed": false, "note": ""}
      ]
    },
    {
      "id": "step-2",
      "name": "初步篩選",
      "type": "establishment",
      "subTasks": []
    },
    {
      "id": "step-3",
      "name": "評估表・訪視",
      "type": "approval",
      "subTasks": [
        {"id": "sub-3-1", "name": "評估表（預期金額）", "completed": false},
        {"id": "sub-3-2", "name": "訪視（機構/董事不用）", "completed": false}
      ]
    },
    {
      "id": "step-4",
      "name": "評議委員會",
      "type": "approval",
      "subTasks": [
        {"id": "sub-4-1", "name": "會議日期", "completed": false, "note": ""}
      ]
    },
    {
      "id": "step-5",
      "name": "寄發通知",
      "type": "approval",
      "subTasks": [
        {"id": "sub-5-1", "name": "寄出通知單", "completed": false},
        {"id": "sub-5-2", "name": "收回申請表正本", "completed": false},
        {"id": "sub-5-3", "name": "核定通知單", "completed": false}
      ]
    },
    {
      "id": "step-6",
      "name": "設定補助・結案",
      "type": "approval",
      "subTasks": [
        {"id": "sub-6-1", "name": "補助期間", "completed": false, "note": ""},
        {"id": "sub-6-2", "name": "補助金額", "completed": false, "note": ""}
      ]
    }
  ]'::JSONB;
BEGIN
  -- 更新 workflow_templates 表
  UPDATE workflow_templates
  SET steps = new_workflow,
      description = '標準公益計畫審核流程（6步驟）'
  WHERE name = '標準審核流程';

  -- 如果沒有「標準審核流程」範本，則新增
  INSERT INTO workflow_templates (name, description, steps)
  SELECT '標準審核流程', '標準公益計畫審核流程（6步驟）', new_workflow
  WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE name = '標準審核流程');

  -- 更新所有 plans 的 workflow
  UPDATE plans
  SET workflow = new_workflow,
      updated_at = NOW();

  RAISE NOTICE '已更新所有 plans 的 workflow';
END $$;

-- 更新所有 projects 的 workflow
-- 注意：這會重設所有專案的流程進度到第一步
DO $$
DECLARE
  project_record RECORD;
  new_workflow JSONB;
  updated_steps JSONB;
  step_json JSONB;
  i INTEGER;
BEGIN
  -- 標準流程定義（帶狀態）
  new_workflow := '[
    {
      "id": "step-1",
      "name": "收到申請",
      "type": "status",
      "status": "in_progress",
      "subTasks": [
        {"id": "sub-1-1", "name": "管道（個人/機構/董事）", "completed": false, "note": ""}
      ]
    },
    {
      "id": "step-2",
      "name": "初步篩選",
      "type": "establishment",
      "status": "pending",
      "subTasks": []
    },
    {
      "id": "step-3",
      "name": "評估表・訪視",
      "type": "approval",
      "status": "pending",
      "subTasks": [
        {"id": "sub-3-1", "name": "評估表（預期金額）", "completed": false},
        {"id": "sub-3-2", "name": "訪視（機構/董事不用）", "completed": false}
      ]
    },
    {
      "id": "step-4",
      "name": "評議委員會",
      "type": "approval",
      "status": "pending",
      "subTasks": [
        {"id": "sub-4-1", "name": "會議日期", "completed": false, "note": ""}
      ]
    },
    {
      "id": "step-5",
      "name": "寄發通知",
      "type": "approval",
      "status": "pending",
      "subTasks": [
        {"id": "sub-5-1", "name": "寄出通知單", "completed": false},
        {"id": "sub-5-2", "name": "收回申請表正本", "completed": false},
        {"id": "sub-5-3", "name": "核定通知單", "completed": false}
      ]
    },
    {
      "id": "step-6",
      "name": "設定補助・結案",
      "type": "approval",
      "status": "pending",
      "subTasks": [
        {"id": "sub-6-1", "name": "補助期間", "completed": false, "note": ""},
        {"id": "sub-6-2", "name": "補助金額", "completed": false, "note": ""}
      ]
    }
  ]'::JSONB;

  -- 更新所有專案，重設到第一步
  UPDATE projects
  SET workflow = new_workflow,
      current_step = 0,
      updated_at = NOW();

  RAISE NOTICE '已更新所有 projects 的 workflow，並重設進度到第一步';
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
