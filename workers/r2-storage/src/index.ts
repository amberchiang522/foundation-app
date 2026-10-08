interface Env {
  AVATARS: R2Bucket
  ACTIVITIES: R2Bucket
  PROJECTS: R2Bucket
  PLANS: R2Bucket
  ATTACHMENTS: R2Bucket
  ALLOWED_ORIGINS: string
  R2_PUBLIC_URL: string
  SUPABASE_JWT_SECRET: string
}

interface JwtPayload {
  sub?: string // user id (may be missing for anon)
  role: string
  aud: string
  iss?: string
  exp?: number
  iat?: number
  // Custom claims from Supabase (app_metadata.role from profiles table)
  user_role?: string
}

// Forbidden JWT roles - these are API keys, not user sessions
const FORBIDDEN_ROLES = ['anon', 'service_role']

// Simple JWT verification for Cloudflare Workers
async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts

    // Decode payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload

    // CRITICAL: Reject anon and service_role tokens - these are API keys, not user sessions
    if (FORBIDDEN_ROLES.includes(payload.role)) {
      return null
    }

    // CRITICAL: Must have a valid user ID (sub claim)
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      return null
    }

    // CRITICAL: Must have expiration and not be expired
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signatureArray = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )

    const data = encoder.encode(`${headerB64}.${payloadB64}`)
    const valid = await crypto.subtle.verify('HMAC', key, signatureArray, data)

    return valid ? payload : null
  } catch {
    return null
  }
}

// Extract and verify auth token from request
async function authenticateRequest(request: Request, env: Env): Promise<{ user: JwtPayload } | { error: string }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header' }
  }

  const token = authHeader.substring(7)
  const payload = await verifyJwt(token, env.SUPABASE_JWT_SECRET)

  if (!payload) {
    return { error: 'Invalid, expired, or unauthorized token' }
  }

  return { user: payload }
}

// Check if user has admin role in the application (not JWT role)
// This requires checking user_role from custom claims or querying database
function isAppAdmin(user: JwtPayload): boolean {
  // Check custom claim if available (set via Supabase auth hook)
  if (user.user_role === 'admin' || user.user_role === 'super_admin') {
    return true
  }
  // Fallback: For now, we don't have custom claims, so we restrict admin operations
  // In production, you should add a custom claim via Supabase auth hook
  return false
}

type BucketName = 'avatars' | 'activities' | 'projects' | 'plans' | 'attachments'

const BUCKET_MAP: Record<BucketName, keyof Env> = {
  avatars: 'AVATARS',
  activities: 'ACTIVITIES',
  projects: 'PROJECTS',
  plans: 'PLANS',
  attachments: 'ATTACHMENTS',
}

// Define which buckets are private (require authentication for download)
const PRIVATE_BUCKETS: BucketName[] = ['attachments', 'projects']

function isPrivateBucket(bucketName: BucketName): boolean {
  return PRIVATE_BUCKETS.includes(bucketName)
}

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || ''
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim())

  // Allow all origins if '*' is in the list, or if origin matches
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin)

  // Always return '*' for public file access to avoid CORS issues with PDF.js workers
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bucket, X-Path, X-Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
  }
}

function getBucket(env: Env, bucketName: BucketName): R2Bucket | null {
  const binding = BUCKET_MAP[bucketName]
  return binding ? (env[binding] as R2Bucket) : null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Health check
      if (path === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Upload file directly (requires authentication)
      if (path === '/upload' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env)
        if ('error' in auth) {
          return new Response(JSON.stringify({ error: auth.error }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        return handleUpload(request, env, corsHeaders, auth.user)
      }

      // Delete file (requires authentication)
      if (path === '/delete' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env)
        if ('error' in auth) {
          return new Response(JSON.stringify({ error: auth.error }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        return handleDelete(request, env, corsHeaders, auth.user)
      }

      // List files in bucket (disabled - admin operations should use Cloudflare dashboard)
      if (path === '/list' && request.method === 'GET') {
        // List operation is disabled for security - use Cloudflare dashboard for admin tasks
        return new Response(JSON.stringify({ error: 'List operation is disabled' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Serve files: /file/{bucket}/{path}
      // Private buckets require authentication
      if (path.startsWith('/file/') && (request.method === 'GET' || request.method === 'HEAD')) {
        // Extract bucket name to check if private
        const pathParts = path.replace('/file/', '').split('/')
        const bucketName = pathParts[0] as BucketName

        if (isPrivateBucket(bucketName)) {
          const auth = await authenticateRequest(request, env)
          if ('error' in auth) {
            return new Response(JSON.stringify({ error: auth.error }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          return handleGetFile(request, env, corsHeaders, auth.user)
        }
        return handleGetFile(request, env, corsHeaders, null)
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  },
}

async function handleUpload(request: Request, env: Env, corsHeaders: HeadersInit, user: JwtPayload): Promise<Response> {
  const bucketName = request.headers.get('X-Bucket') as BucketName
  const filePath = request.headers.get('X-Path')
  const contentType = request.headers.get('X-Content-Type') || 'application/octet-stream'

  if (!bucketName || !filePath) {
    return new Response(JSON.stringify({ error: 'Missing X-Bucket or X-Path header' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Authorization checks for each bucket type
  // Avatars: users can only upload to their own path (user_id/filename)
  if (bucketName === 'avatars') {
    if (!filePath.startsWith(`${user.sub}/`)) {
      return new Response(JSON.stringify({ error: 'Cannot upload to other user avatar path' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }
  // Activities/Plans: files must be prefixed with user ID for ownership tracking
  else if (bucketName === 'activities' || bucketName === 'plans') {
    // Enforce user ID prefix for ownership (format: user_id/activity_id/filename)
    if (!filePath.startsWith(`${user.sub}/`)) {
      return new Response(JSON.stringify({ error: 'File path must start with your user ID' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }
  // Projects/Attachments: private buckets, must have user ID prefix
  else if (bucketName === 'projects' || bucketName === 'attachments') {
    // Enforce user ID prefix for ownership tracking
    if (!filePath.startsWith(`${user.sub}/`)) {
      return new Response(JSON.stringify({ error: 'Private files must be prefixed with your user ID' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const bucket = getBucket(env, bucketName)
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Invalid bucket: ${bucketName}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate content type
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]

  if (!allowedTypes.includes(contentType)) {
    return new Response(JSON.stringify({ error: `Invalid content type: ${contentType}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await request.arrayBuffer()

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024
  if (body.byteLength > maxSize) {
    return new Response(JSON.stringify({ error: 'File too large. Maximum size is 10MB' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Use appropriate cache settings based on bucket type
  const cacheControl = isPrivateBucket(bucketName)
    ? 'private, no-store, must-revalidate'
    : 'public, max-age=31536000'

  await bucket.put(filePath, body, {
    httpMetadata: {
      contentType,
      cacheControl,
    },
  })

  // Use Worker URL to serve files (more reliable than per-bucket public URLs)
  const requestUrl = new URL(request.url)
  const workerBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`
  const fileUrl = `${workerBaseUrl}/file/${bucketName}/${filePath}`

  return new Response(JSON.stringify({
    success: true,
    url: fileUrl,
    bucket: bucketName,
    path: filePath,
    size: body.byteLength,
    contentType,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleDelete(request: Request, env: Env, corsHeaders: HeadersInit, user: JwtPayload): Promise<Response> {
  const { bucket: bucketName, path: filePath } = await request.json() as { bucket: BucketName; path: string }

  if (!bucketName || !filePath) {
    return new Response(JSON.stringify({ error: 'Missing bucket or path' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Authorization checks - users can only delete files they own (prefixed with their user ID)
  if (!filePath.startsWith(`${user.sub}/`)) {
    return new Response(JSON.stringify({ error: 'Cannot delete files owned by other users' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const bucket = getBucket(env, bucketName)
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Invalid bucket: ${bucketName}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await bucket.delete(filePath)

  return new Response(JSON.stringify({ success: true, deleted: filePath }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleList(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
  const url = new URL(request.url)
  const bucketName = url.searchParams.get('bucket') as BucketName
  const prefix = url.searchParams.get('prefix') || ''
  const cursor = url.searchParams.get('cursor') || undefined

  if (!bucketName) {
    return new Response(JSON.stringify({ error: 'Missing bucket parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const bucket = getBucket(env, bucketName)
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Invalid bucket: ${bucketName}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const listed = await bucket.list({
    prefix,
    cursor,
    limit: 1000,
  })

  const files = listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
    url: `${env.R2_PUBLIC_URL}/${bucketName}/${obj.key}`,
  }))

  return new Response(JSON.stringify({
    files,
    truncated: listed.truncated,
    cursor: listed.truncated ? listed.cursor : null,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleGetFile(request: Request, env: Env, corsHeaders: HeadersInit, user: JwtPayload | null): Promise<Response> {
  const url = new URL(request.url)
  // Path format: /file/{bucket}/{...path}
  const pathParts = url.pathname.replace('/file/', '').split('/')
  const bucketName = pathParts[0] as BucketName
  const filePath = pathParts.slice(1).join('/')

  if (!bucketName || !filePath) {
    return new Response(JSON.stringify({ error: 'Invalid file path' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Authorization for private buckets - users can only access their own files
  if (isPrivateBucket(bucketName) && user) {
    if (!filePath.startsWith(`${user.sub}/`)) {
      return new Response(JSON.stringify({ error: 'Cannot access files owned by other users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const bucket = getBucket(env, bucketName)
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Invalid bucket: ${bucketName}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check for Range header (PDF.js uses range requests)
  const rangeHeader = request.headers.get('Range')
  const parsedRange = rangeHeader ? parseRange(rangeHeader) : undefined

  // Fetch object with or without range
  const object = parsedRange
    ? await bucket.get(filePath, { range: parsedRange })
    : await bucket.get(filePath)

  if (!object) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const headers = new Headers(corsHeaders)
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
  // Use appropriate cache settings: private buckets use no-store, public use long cache
  if (isPrivateBucket(bucketName)) {
    headers.set('Cache-Control', 'private, no-store, must-revalidate')
  } else {
    headers.set('Cache-Control', 'public, max-age=31536000')
  }
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Length', object.size.toString())

  // Handle HEAD request
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers })
  }

  // Handle Range request
  if (parsedRange && object.range) {
    const { offset, length } = object.range as { offset: number; length: number }
    headers.set('Content-Length', length.toString())
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    return new Response(object.body, { status: 206, headers })
  }

  return new Response(object.body, { headers })
}

function parseRange(rangeHeader: string): { offset: number; length?: number } | { suffix: number } | undefined {
  // Handle suffix range: bytes=-N (last N bytes)
  const suffixMatch = rangeHeader.match(/bytes=-(\d+)/)
  if (suffixMatch) {
    return { suffix: parseInt(suffixMatch[1], 10) }
  }

  // Handle standard range: bytes=N-M or bytes=N-
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!match) return undefined

  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : undefined

  if (end !== undefined) {
    return { offset: start, length: end - start + 1 }
  }
  return { offset: start }
}
