# Image Upload Feature Plan

## Overview
為基金會系統規劃圖片上傳功能，採用 Service Layer 模式以便未來整合 Supabase Storage。

---

## 1. Image Types Specification

| 類型 | 數量 | 必填 | 比例 | 壓縮 | 單檔上限 |
|------|------|------|------|------|----------|
| 活動封面圖 | 單張 | 是 | 4:3 | 否 | 2MB |
| 志工大頭照 | 單張 | 是 | 1:1 | 否 | 2MB |
| 活動內容圖片 | 最多5張 | 否 | 16:9 | 是 | 2MB |
| 專案成果圖 | 最多5張 | 否 | 16:9 | 是 | 2MB |
| 收據單據 | 最多5張 | 是 | 自由 | 否 | 2MB |

---

## 2. Storage Strategy (Bandwidth Optimization)

### 縮圖 + 原圖分離策略
- **列表/預覽頁面**: 載入縮圖 (thumbnail)
- **詳情/編輯頁面**: 載入原圖 (original)

### Thumbnail Sizes
| 類型 | 縮圖尺寸 |
|------|----------|
| 活動封面圖 | 400x300 |
| 志工大頭照 | 100x100 |
| 活動內容圖片 | 400x225 |
| 專案成果圖 | 400x225 |
| 收據單據 | 300xAuto |

---

## 3. Mock Data Strategy (Phase 1)

### 圖片來源
- **活動/專案圖片**: Unsplash (https://source.unsplash.com)
- **志工大頭照**: i.pravatar.cc
- **收據單據**: 使用 placeholder 或範例圖片

### 預覽機制
- 使用 `URL.createObjectURL()` 產生即時預覽
- 不存入 LocalStorage（圖片檔案過大）
- Mock service 返回 Unsplash/pravatar URL

---

## 4. Upload UX Specification

### 上傳區域設計
```
┌─────────────────────────────────┐
│                                 │
│     ┌───────────────────┐       │
│     │   📷 虛線框區域    │       │
│     │   點擊或拖曳上傳   │       │
│     └───────────────────┘       │
│                                 │
└─────────────────────────────────┘
```

### 預覽方式
- **選擇後立即預覽** (不需確認按鈕)
- **多張圖片**: Grid 網格排列

### 管理功能
| 功能 | 啟用 |
|------|------|
| 拖曳排序 | ✅ |
| 裁切工具 | ❌ |
| 刪除單張 | ✅ |
| 設為封面 | ✅ (多張時) |

---

## 5. Service Layer Architecture

```typescript
// src/services/imageService.ts

interface ImageUploadResult {
  id: string
  originalUrl: string
  thumbnailUrl: string
  fileName: string
  fileSize: number
  mimeType: string
}

interface ImageService {
  upload(file: File, type: ImageType): Promise<ImageUploadResult>
  delete(id: string): Promise<void>
  getThumbnailUrl(id: string): string
  getOriginalUrl(id: string): string
}

// Phase 1: MockImageService (Unsplash + pravatar)
// Phase 2: SupabaseImageService (Supabase Storage)
```

---

## 6. Components to Create

### Core Components
```
src/components/upload/
├── ImageUploader.tsx        # 單張上傳組件
├── MultiImageUploader.tsx   # 多張上傳組件 (with grid)
├── ImagePreview.tsx         # 圖片預覽組件
├── ImageGrid.tsx            # 網格排列 (sortable)
└── DropZone.tsx             # 虛線框拖放區域
```

### Usage Locations
- **活動表單**: ActivityForm → 封面圖 + 內容圖片
- **志工資料**: VolunteerForm → 大頭照
- **專案表單**: ProjectForm → 成果圖
- **核銷表單**: ExpenseForm → 收據單據

---

## 7. Implementation Steps

### Step 1: Service Layer
1. 建立 `imageService.ts` interface
2. 實作 `MockImageService` (Phase 1)
3. 預留 `SupabaseImageService` 接口

### Step 2: Base Components
1. 建立 `DropZone` 拖放區域
2. 建立 `ImagePreview` 預覽組件
3. 建立 `ImageUploader` 單張上傳

### Step 3: Multi-Image Components
1. 建立 `ImageGrid` 網格排列
2. 整合 drag-and-drop sorting
3. 建立 `MultiImageUploader`

### Step 4: Integration
1. 整合到活動表單 (封面 + 內容)
2. 整合到志工表單 (大頭照)
3. 整合到專案表單 (成果圖)
4. 整合到核銷流程 (收據)

---

## 8. Dependencies

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.x",      // Drag and drop
    "@dnd-kit/sortable": "^8.x",  // Sortable list
    "browser-image-compression": "^2.x"  // Client-side compression
  }
}
```

---

## 9. File Validation Rules

```typescript
const validationRules = {
  maxSize: 2 * 1024 * 1024, // 2MB
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  // PDF for receipts
  receiptTypes: ['image/jpeg', 'image/png', 'application/pdf'],
}
```

---

## 10. Future Supabase Integration Notes

### Storage Buckets Structure
```
foundation-storage/
├── activities/
│   ├── covers/
│   │   ├── original/
│   │   └── thumbnails/
│   └── content/
│       ├── original/
│       └── thumbnails/
├── volunteers/
│   └── avatars/
│       ├── original/
│       └── thumbnails/
├── projects/
│   └── results/
│       ├── original/
│       └── thumbnails/
└── receipts/
    ├── original/
    └── thumbnails/
```

### Bandwidth Optimization
- 列表頁使用 `thumbnails/` 路徑
- 詳情頁使用 `original/` 路徑
- 可配合 Supabase Image Transformation 功能

---

## Status: Ready for Implementation
