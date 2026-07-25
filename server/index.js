import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Minimal .env parser (no external dependencies)
async function loadEnv() {
    const env = {}
    try {
        const raw = await readFile(join(__dirname, '.env'), 'utf8')
        for (const line of raw.split('\n')) {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
            if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
        }
    } catch {
        // no .env file — fine, rely on config.json / process.env
    }
    return env
}

async function loadConfig() {
    let cfg = {}
    try {
        const raw = await readFile(join(__dirname, 'config.json'), 'utf8')
        cfg = JSON.parse(raw)
    } catch {
        // missing config.json — use built-in defaults
    }
    const env = await loadEnv()
    return {
        baseURL: cfg.baseURL || 'https://apihub.agnes-ai.com/v1',
        imageModel: cfg.imageModel || 'agnes-image-2.1-flash',
        textModel: cfg.textModel || 'agnes-2.0-flash',
        // Key priority: server/.env (AGNES_API_KEY) > config.json apiKey > process.env
        apiKey:
            env.AGNES_API_KEY ||
            cfg.apiKey ||
            process.env.AGNES_API_KEY ||
            ''
    }
}

const config = await loadConfig()
const PORT = process.env.PORT || 3001

function sendJSON(res, status, obj) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(obj))
}

async function readBody(req) {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
        return JSON.parse(body)
    } catch {
        return null
    }
}

// ---- Image generation (used by the easel + the curator) ----
const IMAGE_TIMEOUT_MS = 90000
const IMAGE_MAX_ATTEMPTS = 2

// One attempt at generating an image; throws on failure so the caller can retry.
async function generateImageOnce(prompt) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS)
    try {
        const upstream = await fetch(`${config.baseURL}/images/generations`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.imageModel,
                prompt: prompt.trim(),
                n: 1,
                size: '1024x1024'
            })
        })

        if (!upstream.ok) {
            const txt = await upstream.text()
            // 5xx / 503 from the upstream are transient — let the caller retry.
            throw new Error(`Upstream error ${upstream.status}: ${txt.slice(0, 200)}`)
        }

        const result = await upstream.json()
        const item = result?.data?.[0]

        if (item?.b64_json) {
            return { bytes: Buffer.from(item.b64_json, 'base64'), contentType: 'image/png' }
        }
        if (item?.url) {
            const imgController = new AbortController()
            const imgTimer = setTimeout(() => imgController.abort(), 60000)
            try {
                const imgRes = await fetch(item.url, { signal: imgController.signal })
                if (!imgRes.ok) throw new Error('Failed to fetch generated image bytes.')
                return {
                    bytes: Buffer.from(await imgRes.arrayBuffer()),
                    contentType: imgRes.headers.get('content-type') || 'image/png'
                }
            } finally {
                clearTimeout(imgTimer)
            }
        }
        throw new Error('No image data returned from upstream API.')
    } finally {
        clearTimeout(timer)
    }
}

async function handleGenerateImage(req, res) {
    if (!config.apiKey) {
        return sendJSON(res, 500, {
            error:
                'Server API key is not configured. Set AGNES_API_KEY in server/.env (see README).'
        })
    }

    const data = await readBody(req)
    const prompt = data?.prompt
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return sendJSON(res, 400, { error: '`prompt` is required.' })
    }

    let lastErr
    for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
        try {
            const { bytes, contentType } = await generateImageOnce(prompt)
            res.setHeader('Content-Type', contentType)
            res.setHeader('Cache-Control', 'no-store')
            return res.end(bytes)
        } catch (err) {
            lastErr = err
            const msg = err.message || ''
            const retryable =
                /Upstream error 5\d\d/.test(msg) ||
                /AbortError|aborted|fetch failed|network|timeout/i.test(msg)
            if (!retryable || attempt === IMAGE_MAX_ATTEMPTS) break
            // Back off before retrying (the upstream is often just busy).
            await new Promise((r) => setTimeout(r, 3000 * attempt))
        }
    }
    return sendJSON(res, 502, {
        error: `Image generation failed after ${IMAGE_MAX_ATTEMPTS} attempts: ${lastErr?.message || 'unknown'}`
    })
}

// ---- Text generation (used by the curator for "search & curation") ----
async function handleGenerateText(req, res) {
    if (!config.apiKey) {
        return sendJSON(res, 500, {
            error: 'Server API key is not configured. Set AGNES_API_KEY in server/.env (see README).'
        })
    }

    const data = await readBody(req)
    const prompt = data?.prompt
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return sendJSON(res, 400, { error: '`prompt` is required.' })
    }

    const messages = []
    if (data?.system && typeof data.system === 'string') {
        messages.push({ role: 'system', content: data.system })
    }
    messages.push({ role: 'user', content: prompt })

    try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 120000)
        const upstream = await fetch(`${config.baseURL}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: data?.model || config.textModel,
                messages,
                temperature: typeof data?.temperature === 'number' ? data.temperature : 0.7
            })
        })
        clearTimeout(timer)

        if (!upstream.ok) {
            const txt = await upstream.text()
            return sendJSON(res, upstream.status, {
                error: `Upstream error ${upstream.status}: ${txt.slice(0, 300)}`
            })
        }

        const result = await upstream.json()
        const text = result?.choices?.[0]?.message?.content || ''
        return sendJSON(res, 200, { text })
    } catch (err) {
        return sendJSON(res, 500, { error: `Proxy error: ${err.message}` })
    }
}

const server = http.createServer(async (req, res) => {
    // CORS: allows the static frontend / curator (on another origin) to call this backend.
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        res.statusCode = 204
        return res.end()
    }

    if (req.method === 'GET' && req.url === '/api/health') {
        return sendJSON(res, 200, { ok: true, hasKey: !!config.apiKey })
    }

    if (req.method === 'POST' && req.url === '/api/generate-image') {
        return handleGenerateImage(req, res)
    }

    if (req.method === 'POST' && req.url === '/api/generate-text') {
        return handleGenerateText(req, res)
    }

    return sendJSON(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
    console.log(`[backend] listening on http://localhost:${PORT} (text+image proxy)`)
})
