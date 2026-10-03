interface Env {
  AVATARS: R2Bucket
  ACTIVITIES: R2Bucket
  PROJECTS: R2Bucket
  PLANS: R2Bucket
  ATTACHMENTS: R2Bucket
  ALLOWED_ORIGINS: string
  R2_PUBLIC_URL: string
}

type BucketName = 'avatars' | 'activities' | 'projects' | 'plans' | 'attachments'

const BUCKET_MAP: Record<BucketName, keyof Env> = {
  avatars: 'AVATARS',
  activities: 'ACTIVITIES',
  projects: 'PROJECTS',
  plans: 'PLANS',
  attachments: 'ATTACHMENTS',
}

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || ''
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim())

  const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*')

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : allowedOrigins[0],
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

      // Upload file directly
      if (path === '/upload' && request.method === 'POST') {
        return handleUpload(request, env, corsHeaders)
      }

      // Delete file
      if (path === '/delete' && request.method === 'POST') {
        return handleDelete(request, env, corsHeaders)
      }

      // List files in bucket (for migration)
      if (path === '/list' && request.method === 'GET') {
        return handleList(request, env, corsHeaders)
      }

      // Serve files: /file/{bucket}/{path}
      if (path.startsWith('/file/') && (request.method === 'GET' || request.method === 'HEAD')) {
        return handleGetFile(request, env, corsHeaders)
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

async function handleUpload(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
  const bucketName = request.headers.get('X-Bucket') as BucketName
  const filePath = request.headers.get('X-Path')
  const contentType = request.headers.get('X-Content-Type') || 'application/octet-stream'

  if (!bucketName || !filePath) {
    return new Response(JSON.stringify({ error: 'Missing X-Bucket or X-Path header' }), {
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

  await bucket.put(filePath, body, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
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

async function handleDelete(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
  const { bucket: bucketName, path: filePath } = await request.json() as { bucket: BucketName; path: string }

  if (!bucketName || !filePath) {
    return new Response(JSON.stringify({ error: 'Missing bucket or path' }), {
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

async function handleGetFile(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
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
  headers.set('Cache-Control', 'public, max-age=31536000')
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
