#!/bin/bash
# 批次刪除 R2 projects bucket 中的所有檔案
# 使用 Wrangler CLI

set -e

BUCKET_NAME="projects"

echo "=== R2 Projects Bucket 清理腳本 ==="
echo ""

# 檢查 wrangler 是否安裝
if ! command -v npx &> /dev/null; then
    echo "❌ 需要安裝 Node.js 和 npx"
    exit 1
fi

# 切換到 worker 目錄（wrangler.toml 所在位置）
cd "$(dirname "$0")/../workers/r2-storage"

echo "📋 列出 $BUCKET_NAME bucket 中的所有檔案..."
echo ""

# 列出所有檔案
FILES=$(npx wrangler r2 object list "$BUCKET_NAME" --json 2>/dev/null | jq -r '.[].key' 2>/dev/null || echo "")

if [ -z "$FILES" ]; then
    echo "✅ Bucket 已經是空的，沒有檔案需要刪除"
    exit 0
fi

# 計算檔案數量
FILE_COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "找到 $FILE_COUNT 個檔案"
echo ""

# 確認刪除
read -p "⚠️  確定要刪除所有 $FILE_COUNT 個檔案嗎？(y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ 已取消"
    exit 0
fi

echo ""
echo "🗑️  開始刪除..."

# 逐一刪除
DELETED=0
FAILED=0

while IFS= read -r file; do
    if [ -n "$file" ]; then
        echo "  刪除: $file"
        if npx wrangler r2 object delete "$BUCKET_NAME/$file" 2>/dev/null; then
            ((DELETED++))
        else
            echo "    ⚠️ 刪除失敗: $file"
            ((FAILED++))
        fi
    fi
done <<< "$FILES"

echo ""
echo "=== 完成 ==="
echo "✅ 成功刪除: $DELETED 個檔案"
if [ $FAILED -gt 0 ]; then
    echo "❌ 刪除失敗: $FAILED 個檔案"
fi
