# Supabase 資料庫設定指南

## 檔案清單

```
supabase/
├── 01_schema.sql     # 資料表結構、ENUM、索引、初始資料
├── 02_rls.sql        # Row Level Security 政策
├── 03_functions.sql  # 輔助函數與 Triggers
├── storage.sql       # Storage Buckets（可選）
└── README.md         # 本說明文件
```

---

## 執行順序（重要！）

請在 Supabase SQL Editor 中 **依序** 執行：

```
1️⃣ 01_schema.sql    → 建立資料表
2️⃣ 02_rls.sql       → 設定存取權限
3️⃣ 03_functions.sql → 建立函數
4️⃣ storage.sql      → 建立 Storage（可選）
```

---

## 快速開始

### Step 1: 取得 Supabase 金鑰

1. 前往 [Supabase Dashboard](https://app.supabase.com)
2. 選擇你的專案
3. 到 **Project Settings** → **API**
4. 複製：
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `eyJhbGciOi...`（很長的 JWT）

### Step 2: 執行 SQL

1. 到 Supabase Dashboard → **SQL Editor**
2. 開新 Query
3. 貼上 `01_schema.sql` 內容 → 執行
4. 貼上 `02_rls.sql` 內容 → 執行
5. 貼上 `03_functions.sql` 內容 → 執行

### Step 3: 建立管理員帳號

1. 到 **Authentication** → **Users** → **Add user**
2. 輸入：
   - Email: `b232914712000@gmail.com`
   - Password: `0963663073`
3. 複製該使用者的 **User UID**
4. 在 SQL Editor 執行：

```sql
SELECT setup_initial_admin(
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 使用者 UUID
  'b232914712000@gmail.com',
  '系統管理員',
  '0963663073'
);
```

### Step 4: 前端環境設定

在專案根目錄建立 `.env.local`：

```env
VITE_SUPABASE_URL=https://mxydtxluiqqmxieififh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi... (從 Dashboard 複製)
```

---

## 資料表架構

| 資料表 | 說明 |
|--------|------|
| `profiles` | 使用者/志工（連結 auth.users）|
| `admin_tags` | 管理員標籤 |
| `user_admin_tags` | 使用者-標籤關聯 |
| `volunteer_applications` | 志工申請 |
| `plans` | 計畫 |
| `projects` | 專案 |
| `project_types` | 專案類型設定 |
| `workflow_templates` | 流程範本 |
| `activities` | 活動 |
| `activity_registrations` | 活動報名 |
| `images` | 圖片元資料 |
| `system_settings` | 系統設定 |

---

## 常見問題

### Q: 出現 "relation does not exist" 錯誤

**原因**: SQL 執行順序錯誤

**解決**: 請依序執行 01 → 02 → 03

### Q: anon key 格式是什麼？

正確的 anon key 格式：
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
```

不是 `sb_publishable_...` 這種格式。

### Q: 如何重新執行 SQL？

所有 SQL 都使用 `IF NOT EXISTS` 和 `DROP IF EXISTS`，可以安全重複執行。

---

## 下一步

完成資料庫設定後，執行前端對接：

1. 安裝 Supabase Client
2. 建立 Service Layer
3. 實作 Auth Context
