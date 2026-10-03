/**
 * Migration Script: Supabase Storage to Cloudflare R2
 *
 * This script migrates all files from Supabase Storage to R2,
 * then updates database URLs to point to R2.
 *
 * Prerequisites:
 * 1. R2 buckets created and public access enabled
 * 2. Cloudflare Worker deployed
 * 3. Environment variables set:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY (not anon key - need full access)
 *    - R2_WORKER_URL
 *    - R2_PUBLIC_URL
 *
 * Usage:
 * npx tsx scripts/migrate-to-r2.ts
 */

import { createClient } from '@supabase/supabase-js'

// Configuration - update these before running
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const R2_WORKER_URL = process.env.R2_WORKER_URL || ''
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

// Bucket mapping: Supabase bucket -> R2 bucket
const BUCKET_MAP: Record<string, string> = {
  avatars: 'avatars',
  activities: 'activities',
  projects: 'projects',
  plans: 'plans',
  attachments: 'attachments',
  forum: 'activities', // Map forum to activities in R2
}

interface MigrationResult {
  bucket: string
  path: string
  supabaseUrl: string
  r2Url: string
  success: boolean
  error?: string
}

async function migrateFile(
  supabase: ReturnType<typeof createClient>,
  supabaseBucket: string,
  filePath: string
): Promise<MigrationResult> {
  const r2Bucket = BUCKET_MAP[supabaseBucket] || supabaseBucket

  try {
    // Download from Supabase
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(supabaseBucket)
      .download(filePath)

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message || 'No data'}`)
    }

    // Determine content type
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentType = getContentType(ext || '')

    // Upload to R2 via Worker
    const response = await fetch(`${R2_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-Bucket': r2Bucket,
        'X-Path': filePath,
        'X-Content-Type': contentType,
      },
      body: fileData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`R2 upload failed: ${error.error}`)
    }

    const result = await response.json()

    // Get Supabase public URL for reference
    const { data: urlData } = supabase.storage
      .from(supabaseBucket)
      .getPublicUrl(filePath)

    return {
      bucket: supabaseBucket,
      path: filePath,
      supabaseUrl: urlData.publicUrl,
      r2Url: result.url,
      success: true,
    }
  } catch (error) {
    return {
      bucket: supabaseBucket,
      path: filePath,
      supabaseUrl: '',
      r2Url: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  return types[ext] || 'application/octet-stream'
}

async function listAllFiles(
  supabase: ReturnType<typeof createClient>,
  bucket: string
): Promise<string[]> {
  const allFiles: string[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list('', { limit, offset })

    if (error) {
      console.error(`Error listing ${bucket}:`, error.message)
      break
    }

    if (!data || data.length === 0) break

    // Recursively get files from folders
    for (const item of data) {
      if (item.id === null) {
        // This is a folder, list its contents
        const folderFiles = await listFilesInFolder(supabase, bucket, item.name)
        allFiles.push(...folderFiles)
      } else {
        allFiles.push(item.name)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return allFiles
}

async function listFilesInFolder(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  folder: string
): Promise<string[]> {
  const files: string[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit, offset })

    if (error || !data || data.length === 0) break

    for (const item of data) {
      if (item.id === null) {
        // Nested folder
        const nestedFiles = await listFilesInFolder(supabase, bucket, `${folder}/${item.name}`)
        files.push(...nestedFiles)
      } else {
        files.push(`${folder}/${item.name}`)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return files
}

async function updateDatabaseUrls(
  supabase: ReturnType<typeof createClient>,
  urlMappings: Map<string, string>
): Promise<void> {
  console.log('\n=== Updating Database URLs ===\n')

  // Tables and columns that contain storage URLs
  const updates = [
    { table: 'activities', columns: ['cover_image', 'content_images'] },
    { table: 'projects', columns: ['result_images', 'receipt_images'] },
    { table: 'plans', columns: ['cover_image', 'intro_pdf', 'download_pdfs'] },
    { table: 'event_reviews', columns: ['images'] },
    { table: 'forum_posts', columns: ['images'] },
    { table: 'volunteers', columns: ['avatar_url'] },
  ]

  for (const { table, columns } of updates) {
    console.log(`Processing ${table}...`)

    // Fetch all records
    const { data: records, error } = await supabase
      .from(table)
      .select(`id, ${columns.join(', ')}`)

    if (error) {
      console.error(`  Error fetching ${table}:`, error.message)
      continue
    }

    if (!records || records.length === 0) {
      console.log(`  No records found`)
      continue
    }

    let updatedCount = 0

    for (const record of records) {
      const updates: Record<string, unknown> = {}
      let hasUpdates = false

      for (const col of columns) {
        const value = record[col]
        if (!value) continue

        if (typeof value === 'string') {
          // Single URL field
          const newUrl = findNewUrl(value, urlMappings)
          if (newUrl && newUrl !== value) {
            updates[col] = newUrl
            hasUpdates = true
          }
        } else if (Array.isArray(value)) {
          // Array of objects with URLs
          const newArray = value.map((item: Record<string, unknown>) => {
            if (typeof item === 'string') {
              return findNewUrl(item, urlMappings) || item
            }
            const newItem = { ...item }
            for (const key of Object.keys(item)) {
              if (typeof item[key] === 'string' && item[key].includes('supabase')) {
                const newUrl = findNewUrl(item[key] as string, urlMappings)
                if (newUrl) {
                  newItem[key] = newUrl
                }
              }
            }
            return newItem
          })
          updates[col] = newArray
          hasUpdates = true
        } else if (typeof value === 'object') {
          // Object with URLs
          const newObj = { ...value }
          for (const key of Object.keys(value)) {
            if (typeof value[key] === 'string' && value[key].includes('supabase')) {
              const newUrl = findNewUrl(value[key], urlMappings)
              if (newUrl) {
                (newObj as Record<string, unknown>)[key] = newUrl
              }
            }
          }
          updates[col] = newObj
          hasUpdates = true
        }
      }

      if (hasUpdates) {
        const { error: updateError } = await supabase
          .from(table)
          .update(updates)
          .eq('id', record.id)

        if (updateError) {
          console.error(`  Error updating record ${record.id}:`, updateError.message)
        } else {
          updatedCount++
        }
      }
    }

    console.log(`  Updated ${updatedCount} records`)
  }
}

function findNewUrl(oldUrl: string, mappings: Map<string, string>): string | null {
  for (const [supabaseUrl, r2Url] of mappings) {
    if (oldUrl === supabaseUrl || oldUrl.includes(supabaseUrl)) {
      return oldUrl.replace(supabaseUrl, r2Url)
    }
  }
  return null
}

async function main() {
  console.log('=== Supabase to R2 Migration ===\n')

  // Validate configuration
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    console.error('Set these environment variables before running the script.')
    process.exit(1)
  }

  if (!R2_WORKER_URL || !R2_PUBLIC_URL) {
    console.error('Error: R2_WORKER_URL and R2_PUBLIC_URL are required')
    console.error('Set these environment variables before running the script.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const buckets = Object.keys(BUCKET_MAP)
  const allResults: MigrationResult[] = []
  const urlMappings = new Map<string, string>()

  for (const bucket of buckets) {
    console.log(`\nProcessing bucket: ${bucket}`)

    const files = await listAllFiles(supabase, bucket)
    console.log(`  Found ${files.length} files`)

    for (const filePath of files) {
      process.stdout.write(`  Migrating: ${filePath}... `)

      const result = await migrateFile(supabase, bucket, filePath)
      allResults.push(result)

      if (result.success) {
        console.log('✓')
        urlMappings.set(result.supabaseUrl, result.r2Url)
      } else {
        console.log(`✗ ${result.error}`)
      }
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===')
  const successful = allResults.filter((r) => r.success)
  const failed = allResults.filter((r) => !r.success)

  console.log(`Total files: ${allResults.length}`)
  console.log(`Successful: ${successful.length}`)
  console.log(`Failed: ${failed.length}`)

  if (failed.length > 0) {
    console.log('\nFailed files:')
    for (const f of failed) {
      console.log(`  ${f.bucket}/${f.path}: ${f.error}`)
    }
  }

  // Ask to update database
  if (successful.length > 0) {
    console.log('\nWould you like to update database URLs? (This will modify your database)')
    console.log('Run with --update-db flag to proceed')

    if (process.argv.includes('--update-db')) {
      await updateDatabaseUrls(supabase, urlMappings)
    }
  }

  // Save URL mappings to file for reference
  const mappingsArray = Array.from(urlMappings.entries()).map(([old, newUrl]) => ({
    supabase: old,
    r2: newUrl,
  }))

  const fs = await import('fs')
  fs.writeFileSync(
    'migration-url-mappings.json',
    JSON.stringify(mappingsArray, null, 2)
  )
  console.log('\nURL mappings saved to migration-url-mappings.json')
}

main().catch(console.error)
