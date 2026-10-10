/**
 * 批次刪除 R2 bucket 中的所有檔案
 *
 * 使用方式:
 * npx tsx scripts/clear-r2-bucket.ts projects
 * npx tsx scripts/clear-r2-bucket.ts plans
 *
 * 需要設定環境變數:
 * - R2_WORKER_URL: Worker URL
 * - SUPABASE_URL: Supabase URL
 * - ADMIN_EMAIL: Admin 帳號
 * - ADMIN_PASSWORD: Admin 密碼
 */

import * as readline from 'readline'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const VALID_BUCKETS = ['projects', 'plans', 'activities', 'avatars', 'attachments']

const R2_WORKER_URL = process.env.VITE_R2_WORKER_URL || process.env.R2_WORKER_URL || ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''

interface R2ListResult {
  files: Array<{ key: string; size: number; uploaded: string; url: string }>
  truncated: boolean
  cursor: string | null
}

async function askConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}

async function getAuthToken(): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('請設定 SUPABASE_URL 和 SUPABASE_ANON_KEY 環境變數')
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('請設定 ADMIN_EMAIL 和 ADMIN_PASSWORD 環境變數')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })

  if (error || !data.session) {
    throw new Error(`登入失敗: ${error?.message || '無法取得 session'}`)
  }

  return data.session.access_token
}

async function listFiles(token: string, bucket: string): Promise<string[]> {
  const allFiles: string[] = []
  let cursor: string | undefined

  do {
    const params = new URLSearchParams({ bucket })
    if (cursor) params.append('cursor', cursor)

    const response = await fetch(`${R2_WORKER_URL}/list?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(`列出檔案失敗: ${(err as { error?: string }).error || response.status}`)
    }

    const result = (await response.json()) as R2ListResult
    allFiles.push(...result.files.map((f) => f.key))

    cursor = result.truncated && result.cursor ? result.cursor : undefined
  } while (cursor)

  return allFiles
}

async function deleteFile(token: string, bucket: string, path: string): Promise<boolean> {
  const response = await fetch(`${R2_WORKER_URL}/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucket, path }),
  })

  return response.ok
}

async function main() {
  const bucketName = process.argv[2]

  if (!bucketName) {
    console.log('使用方式: npx tsx scripts/clear-r2-bucket.ts <bucket-name>')
    console.log('可用的 bucket:', VALID_BUCKETS.join(', '))
    process.exit(1)
  }

  if (!VALID_BUCKETS.includes(bucketName)) {
    console.error(`❌ 無效的 bucket: ${bucketName}`)
    console.log('可用的 bucket:', VALID_BUCKETS.join(', '))
    process.exit(1)
  }

  if (!R2_WORKER_URL) {
    console.error('❌ 請設定 R2_WORKER_URL 或 VITE_R2_WORKER_URL 環境變數')
    process.exit(1)
  }

  console.log(`\n=== R2 ${bucketName} Bucket 清理腳本 ===\n`)

  // 登入取得 token
  console.log('🔐 登入中...')
  let token: string
  try {
    token = await getAuthToken()
    console.log('✅ 登入成功\n')
  } catch (error) {
    console.error(`❌ ${(error as Error).message}`)
    process.exit(1)
  }

  console.log(`📋 列出 ${bucketName} bucket 中的所有檔案...\n`)

  let files: string[] = []
  try {
    files = await listFiles(token, bucketName)

    if (files.length === 0) {
      console.log('✅ Bucket 已經是空的，沒有檔案需要刪除')
      process.exit(0)
    }

    console.log(`找到 ${files.length} 個檔案:\n`)
    files.slice(0, 10).forEach((f) => console.log(`  - ${f}`))
    if (files.length > 10) {
      console.log(`  ... 還有 ${files.length - 10} 個檔案`)
    }
    console.log('')
  } catch (error) {
    console.error(`❌ ${(error as Error).message}`)
    process.exit(1)
  }

  // 確認刪除
  const confirm = await askConfirm(`⚠️  確定要刪除所有 ${files.length} 個檔案嗎？(y/N): `)
  if (!confirm) {
    console.log('❌ 已取消')
    process.exit(0)
  }

  console.log('\n🗑️  開始刪除...\n')

  let deleted = 0
  let failed = 0

  for (const file of files) {
    const success = await deleteFile(token, bucketName, file)
    if (success) {
      console.log(`  ✓ ${file}`)
      deleted++
    } else {
      console.log(`  ✗ ${file} (刪除失敗)`)
      failed++
    }
  }

  console.log('\n=== 完成 ===')
  console.log(`✅ 成功刪除: ${deleted} 個檔案`)
  if (failed > 0) {
    console.log(`❌ 刪除失敗: ${failed} 個檔案`)
  }
}

main().catch(console.error)
