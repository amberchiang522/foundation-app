-- =====================================================
-- 重新命名 Step 4 (文件寄發及簽核) 的子任務名稱
-- sub-4-1: 寄出通知單 → 通知核定結果
-- sub-4-2: 收回申請表正本 → 寄出核定通知單
-- sub-4-3: 核定通知單 → 收回通知單及申請表整本
-- =====================================================

-- 更新 workflow_templates 表
UPDATE workflow_templates
SET steps = jsonb_set(
  jsonb_set(
    jsonb_set(
      steps,
      '{3,subTasks,0,name}',
      '"通知核定結果"'
    ),
    '{3,subTasks,1,name}',
    '"寄出核定通知單"'
  ),
  '{3,subTasks,2,name}',
  '"收回通知單及申請表整本"'
)
WHERE name = '標準審核流程';

-- 更新 plans 表的 workflow
UPDATE plans
SET workflow = jsonb_set(
  jsonb_set(
    jsonb_set(
      workflow,
      '{3,subTasks,0,name}',
      '"通知核定結果"'
    ),
    '{3,subTasks,1,name}',
    '"寄出核定通知單"'
  ),
  '{3,subTasks,2,name}',
  '"收回通知單及申請表整本"'
),
updated_at = NOW()
WHERE jsonb_array_length(workflow) >= 4;

-- 更新 projects 表的 workflow
UPDATE projects
SET workflow = jsonb_set(
  jsonb_set(
    jsonb_set(
      workflow,
      '{3,subTasks,0,name}',
      '"通知核定結果"'
    ),
    '{3,subTasks,1,name}',
    '"寄出核定通知單"'
  ),
  '{3,subTasks,2,name}',
  '"收回通知單及申請表整本"'
),
updated_at = NOW()
WHERE jsonb_array_length(workflow) >= 4;

-- 驗證更新結果
SELECT
  'projects' as table_name,
  id,
  workflow->3->'subTasks'->0->>'name' as subtask_1,
  workflow->3->'subTasks'->1->>'name' as subtask_2,
  workflow->3->'subTasks'->2->>'name' as subtask_3
FROM projects
LIMIT 3;
