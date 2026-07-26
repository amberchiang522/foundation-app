# PLAN.md - 志工與專案管理系統

## 專案概述

基金會志工與專案管理系統，包含前台（公開頁面）與後台（管理系統）。

### 開發策略

| 階段 | 目標 | 說明 |
|------|------|------|
| Phase 1 | 全前端 Mock | 純前端資料模擬，所有功能可操作測試 |
| Phase 2 | Supabase 對接 | 無縫切換至 Supabase Backend + Auth |

---

## 技術棧

| 類別 | 選擇 |
|------|------|
| 框架 | React + Vite |
| UI | Shadcn/ui + Tailwind CSS |
| 狀態管理 | React Context / Zustand（視複雜度決定） |
| 路由 | React Router |
| 驗證（Phase 2） | Supabase Auth |
| 資料庫（Phase 2） | Supabase (PostgreSQL) |
| RWD | 全站完整手機支援 |

---

## 角色與權限

### 基礎角色

| 角色 | 權限範圍 |
|------|----------|
| 訪客 (Guest) | 瀏覽首頁、活動列表、申請成為志工、查詢申請進度 |
| 一般志工 | 登入後台、管理個人資料、瀏覽活動、報名/取消報名、查看服務紀錄 |
| 管理員 (Admin) | 全部後台功能、審核、建立計畫/專案/活動、系統設定 |

### 管理員標籤系統

- 管理員可被賦予自訂標籤（如「財務組長」「活動組長」）
- 流程節點審批可指定「具特定標籤的管理員」或「特定個人」
- 標籤由系統設定頁面管理

---

## 志工類型與編號

### 類型判定

- **青年志工**：年齡 < 分界年齡（預設 30 歲，可於系統設定調整）
- **社會志工**：年齡 >= 分界年齡

### 編號格式

- 青年志工：`Y-001`、`Y-002`...
- 社會志工：`S-001`、`S-002`...
- 流水號依類型獨立計算

---

## 頁面結構

### 前台 (Public)

```
/                       # 首頁（最新活動列表）
/activities             # 活動列表（進行中 + 未來）
/activities/past        # 已結束活動
/activities/:id         # 活動詳情
/apply                  # 志工申請表單
/apply/status           # 申請進度查詢
/apply/edit/:token      # 補件修改頁面
/login                  # 登入頁面
```

### 後台 (Dashboard)

```
/dashboard                      # 儀表板首頁（統計數據）
/dashboard/profile              # 個人資料管理（志工）
/dashboard/my-activities        # 我的報名紀錄（志工）
/dashboard/my-service           # 服務時數紀錄（志工）

# === 以下需管理員權限 ===
/dashboard/volunteers           # 志工管理
/dashboard/volunteers/:id       # 志工詳情
/dashboard/applications         # 志工申請審核

/dashboard/plans                # 計畫管理
/dashboard/plans/:id            # 計畫詳情
/dashboard/plans/:id/projects   # 計畫內專案列表

/dashboard/projects             # 專案管理（全部）
/dashboard/projects/:id         # 專案詳情與流程追蹤

/dashboard/activities           # 活動管理
/dashboard/activities/new       # 新增活動
/dashboard/activities/:id       # 活動詳情與報名管理

/dashboard/reports              # 報表中心
/dashboard/settings             # 系統設定
```

---

## 資料模型

### User（使用者/志工）

```typescript
interface User {
  id: string;
  volunteerNumber: string;      // Y-001 或 S-001
  type: 'youth' | 'social';     // 自動依年齡判定
  role: 'volunteer' | 'admin';
  adminTags?: string[];         // 管理員標籤（僅 admin）

  // 基本資料
  name: string;
  email: string;                // 登入帳號
  phone: string;                // 預設密碼
  birthday: Date;
  occupation: string;
  experience: string;           // 相關經驗
  lineId: string;

  // 狀態
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}
```

### VolunteerApplication（志工申請）

```typescript
interface VolunteerApplication {
  id: string;
  token: string;                // 補件連結用

  // 表單資料（同 User 基本資料）
  name: string;
  email: string;
  phone: string;
  birthday: Date;
  occupation: string;
  experience: string;
  lineId: string;
  volunteerType: 'youth' | 'social';  // 依年齡自動判定

  // 審核狀態
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewNote?: string;          // 審核備註（拒絕理由或補件要求）
  reviewedBy?: string;          // 審核者 ID
  reviewedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

### Plan（計畫）

```typescript
interface Plan {
  id: string;
  name: string;
  description: string;
  type: string;                 // 計畫類型

  // 流程定義
  workflow: WorkflowStep[];

  status: 'active' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Project（專案）

```typescript
interface Project {
  id: string;
  planId: string;               // 所屬計畫
  name: string;
  description: string;

  // 類型與撥款
  projectType: string;          // 專案類型（如「急難救助」）
  budgetAmount: number;         // 撥款額度

  // 流程狀態
  workflow: WorkflowStep[];     // 繼承自計畫，可自訂
  currentStep: number;          // 當前步驟 index

  status: 'active' | 'completed' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### WorkflowStep（流程步驟）

```typescript
interface WorkflowStep {
  id: string;
  name: string;                 // 步驟名稱（如「財務審核」）
  type: 'status' | 'approval';  // 狀態追蹤 或 需審批

  // 審批設定（type='approval' 時）
  approverType?: 'tag' | 'person';
  approverTagId?: string;       // 指定標籤
  approverUserId?: string;      // 指定個人

  // 執行狀態（專案使用）
  status?: 'pending' | 'in_progress' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  note?: string;
}
```

### ProjectType（專案類型設定）

```typescript
interface ProjectType {
  id: string;
  name: string;                 // 如「急難救助」
  budgetMin: number;            // 最低額度
  budgetMax: number;            // 最高額度
  defaultWorkflow?: WorkflowStep[];  // 預設流程範本
}
```

### Activity（活動）

```typescript
interface Activity {
  id: string;
  projectId?: string;           // 可選：關聯專案

  name: string;
  description: string;
  date: Date;
  location: string;
  type: string;                 // 活動類型
  backgroundImage?: string;

  // 報名設定
  capacity: number;             // 需求人數
  registrationMode: 'direct' | 'approval';  // 報名即確認 / 需審核

  status: 'upcoming' | 'ongoing' | 'completed' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### ActivityRegistration（活動報名）

```typescript
interface ActivityRegistration {
  id: string;
  activityId: string;
  userId: string;

  status: 'confirmed' | 'pending' | 'waitlist' | 'cancelled';
  waitlistPosition?: number;    // 候補順位

  // 審核（registrationMode='approval' 時）
  reviewedBy?: string;
  reviewedAt?: Date;

  // 參與紀錄
  attended?: boolean;           // 實際出席
  serviceHours?: number;        // 服務時數

  createdAt: Date;
  updatedAt: Date;
}
```

### AdminTag（管理員標籤）

```typescript
interface AdminTag {
  id: string;
  name: string;                 // 如「財務組長」
  description?: string;
  createdAt: Date;
}
```

### SystemSettings（系統設定）

```typescript
interface SystemSettings {
  youthAgeThreshold: number;    // 青年志工年齡分界（預設 30）
  // 其他系統設定...
}
```

---

## 功能模組詳細規格

### 1. 志工申請流程

```
訪客填寫表單 → 提交申請 → 管理員審核
                              ├─ 通過 → 建立帳號 → 發送 Email（含登入資訊）
                              ├─ 拒絕 → 發送 Email（含理由）
                              └─ 補件 → 發送 Email（含補件連結）→ 修改後重新送審
```

**補件機制：**
- 申請時產生唯一 token
- 補件 Email 包含連結：`/apply/edit/:token`
- 進度查詢頁：輸入 Email 可查看狀態

### 2. 活動報名流程

```
志工瀏覽活動 → 點擊報名
                 │
                 ├─ 直接確認模式 ─┬─ 未額滿 → 直接確認
                 │                └─ 已額滿 → 進入候補
                 │
                 └─ 審核模式 ─────┬─ 待審核 → 管理員審核 → 確認/拒絕
                                  └─ 已額滿 → 進入候補（審核後依序處理）
```

**候補遞補：**
- 有人取消 → 自動通知候補第一位
- 候補者需在期限內確認，否則順延下一位

### 3. 計畫與專案流程

```
建立計畫（定義流程範本）
    └─ 新增專案（繼承流程，可微調）
           └─ 執行流程
                 ├─ 狀態型步驟：手動切換狀態
                 └─ 審批型步驟：指定審批人 → 審批通過/拒絕 → 推進
```

**流程範本：**
- 系統設定可建立常用流程範本
- 建立計畫時可選用範本或自訂
- 專案繼承計畫流程，可針對個案調整

### 4. 報表功能

**儀表板統計：**
- 志工總數（依類型分類）
- 本月活動數
- 待審核件數（志工申請、活動報名、專案審批）
- 本月服務總時數

**匯出報表：**
- 志工名冊（可篩選類型、狀態）
- 活動參與紀錄（可篩選日期範圍）
- 專案撥款統計（依類型、狀態）
- 個人服務時數明細

---

## 系統設定項目

| 設定項 | 說明 |
|--------|------|
| 志工年齡分界 | 青年/社會志工分界年齡（預設 30） |
| 專案類型管理 | 新增/編輯/刪除專案類型與額度範圍 |
| 管理員標籤管理 | 新增/編輯/刪除標籤 |
| 流程範本管理 | 建立常用流程範本 |
| Email 通知設定 | 通知模板、開關（Phase 2） |

---

## Mock 資料（Phase 1）

### 預設管理員帳號

```
Email: b232914712000@gmail.com
密碼: 0963663073
```

> ⚠️ 正式上線前需移除此寫死帳號

### 預設資料

- 2-3 筆範例活動
- 1-2 筆範例計畫與專案
- 數筆測試志工資料
- 預設專案類型（如：急難救助、獎助學金）

---

## 實作優先順序

### Phase 1-A：核心骨架

1. 專案初始化（Vite + React + Shadcn/ui + Tailwind）
2. 路由架構與版面 Layout
3. Mock 資料服務層（為 Supabase 預留介面）
4. 登入機制（Mock 驗證）

### Phase 1-B：前台功能

5. 首頁與活動列表（分頁、篩選）
6. 活動詳情頁
7. 志工申請表單
8. 申請進度查詢頁

### Phase 1-C：後台基礎

9. 儀表板首頁（統計卡片）
10. 志工個人資料管理
11. 活動報名與紀錄查詢
12. 服務時數頁面

### Phase 1-D：後台管理

13. 志工管理（列表、詳情、停權）
14. 志工申請審核（通過/拒絕/補件）
15. 活動管理（CRUD、報名名單）
16. 計畫管理（CRUD、流程設定）
17. 專案管理（CRUD、流程追蹤）

### Phase 1-E：進階功能

18. 系統設定頁面
19. 報表中心與匯出功能
20. RWD 優化與測試

### Phase 2：Supabase 對接

21. Supabase 專案設定與資料表建立
22. 切換至 Supabase Auth
23. 資料服務層對接
24. Email 通知實作（Supabase Edge Functions 或第三方）
25. 正式部署

---

## 檔案結構（建議）

```
src/
├── components/
│   ├── ui/                 # Shadcn/ui 元件
│   ├── layout/             # Layout 元件
│   └── shared/             # 共用元件
├── pages/
│   ├── public/             # 前台頁面
│   └── dashboard/          # 後台頁面
├── services/
│   ├── mock/               # Mock 資料服務
│   └── api/                # API 介面（Phase 2 切換用）
├── stores/                 # 狀態管理
├── hooks/                  # 自訂 Hooks
├── types/                  # TypeScript 型別定義
├── utils/                  # 工具函式
└── data/                   # Mock 資料
```

---

## 注意事項

1. **資料服務抽象化**：所有資料操作透過 service 層，Phase 2 只需替換實作
2. **驗證邏輯分離**：Auth 邏輯獨立，便於切換 Supabase Auth
3. **表單驗證**：使用 react-hook-form + zod
4. **日期處理**：使用 date-fns
5. **匯出功能**：CSV 可用 papaparse，Excel 可用 xlsx

---

## Grill 確認清單

- [x] 技術棧：React + Vite + Shadcn/ui + Tailwind
- [x] 登入機制：Email + 手機預設密碼，Supabase Auth
- [x] 角色權限：志工 / 管理員（可貼標籤）
- [x] 志工類型：青年(Y-) / 社會(S-)，依年齡判定，分界可設定
- [x] 志工申請：通過 / 拒絕 / 補件，Email + 進度查詢
- [x] 活動報名：混合制，額滿開放候補
- [x] 計畫專案：可自訂流程（狀態+審批），動態指派審批人
- [x] 專案撥款：類型額度可自訂，整合流程節點
- [x] 活動關聯：可獨立或掛載專案
- [x] 資料處理：志工停權、活動/計畫/專案封存
- [x] RWD：全站完整手機支援
- [x] 報表：儀表板 + CSV/Excel 匯出
