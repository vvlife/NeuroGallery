import http from 'node:http'
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { spawn, execSync, execFile } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NEURO_ROOT = resolve(__dirname, '..')
const PAINTINGS_DIR = join(NEURO_ROOT, 'public', 'textures', 'paintings')
const CONFIG_FILE = join(PAINTINGS_DIR, 'painting_data.json')
const VITE_BIN = join(NEURO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const NODE_BIN = '/Users/nxhuang/.workbuddy/binaries/node/versions/22.22.2/bin/node'

const BACKEND = 'http://localhost:3001'
const GALLERY = 'http://localhost:5173'
const CURATOR_PORT = process.env.CURATOR_PORT || 4000
const CURL_BIN = '/usr/bin/curl'

// Fixed wall positions (back wall x3, front wall x3). The curator only swaps
// the content of these slots, so the gallery layout stays valid.
const POSITIONS = [
    [-6, 3.5, -11.8],
    [0, 3.5, -11.8],
    [6, 3.5, -11.8],
    [-6, 3.5, 11.8],
    [0, 3.5, 11.8],
    [6, 3.5, 11.8]
]

const galleryChild = { ref: null }

function logLine(res, obj) {
    res.write(JSON.stringify(obj) + '\n')
}

async function httpOK(url, timeout = 2000) {
    try {
        const c = new AbortController()
        const t = setTimeout(() => c.abort(), timeout)
        const r = await fetch(url, { method: 'GET', signal: c.signal })
        clearTimeout(t)
        return r.ok
    } catch {
        return false
    }
}

async function waitUp(url, { timeout = 120000, interval = 1000 } = {}) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        if (await httpOK(url)) return true
        await new Promise((r) => setTimeout(r, interval))
    }
    return false
}

function killPort(port) {
    try {
        const pids = execSync(`lsof -ti tcp:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim()
            .split('\n')
            .filter(Boolean)
        for (const pid of pids) {
            try {
                process.kill(Number(pid), 'SIGTERM')
            } catch {
            }
        }
    } catch {
        // lsof unavailable or nothing listening
    }
}

function spawnGallery() {
    if (galleryChild.ref && !galleryChild.ref.killed) return galleryChild.ref
    const child = spawn(NODE_BIN, [VITE_BIN], {
        cwd: NEURO_ROOT,
        env: { ...process.env, PATH: `${dirname(NODE_BIN)}:${process.env.PATH || ''}` },
        stdio: 'ignore'
    })
    galleryChild.ref = child
    return child
}

async function ensureGallery() {
    if (await httpOK(GALLERY)) return true
    spawnGallery()
    const ok = await waitUp(GALLERY, { timeout: 90000 })
    // Backend is spawned by Vite's plugin; wait for it too.
    await waitUp(`${BACKEND}/api/health`, { timeout: 30000 }).catch(() => {})
    return ok
}

// After rewriting painting_data.json, we do NOT kill & respawn the gallery.
// Instead we rely on Vite's built-in watcher: changes under public/ trigger a
// full page reload → Paintings.loadPaintingData() re-fetches the fresh JSON.
// This avoids fragile process management (port races, orphan children, etc.)
// while keeping the experience smooth for the user.
async function refreshGallery() {
    // If the gallery isn't running at all, start it.
    if (!(await httpOK(GALLERY))) {
        return ensureGallery()
    }
    // Gallery is already running — Vite will auto-reload on the file write.
    // Give it a moment to detect the change and reload.
    await new Promise((r) => setTimeout(r, 3000))
    // Confirm it survived the reload cycle.
    return await httpOK(GALLERY)
}

async function callBackendText(prompt, system) {
    const r = await fetch(`${BACKEND}/api/generate-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, system })
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'text generation failed')
    return j.text
}

// ---- Real image sourcing via Wikimedia Commons (no AI generation) ----
// The sandbox's node fetch cannot reach upload.wikimedia.org, but `curl` can,
// so we search with fetch (commons API) and download bytes with curl.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withRetry(fn, retries = 3, waitMs = 800) {
    let lastErr
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn()
        } catch (e) {
            lastErr = e
            if (i < retries) await sleep(waitMs)
        }
    }
    throw lastErr
}

async function searchCommonsImage(query) {
    return withRetry(async () => {
        const url =
            'https://commons.wikimedia.org/w/api.php?action=query' +
            '&generator=search&gsrsearch=' + encodeURIComponent(query) +
            '&gsrnamespace=6&gsrlimit=10' +
            '&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1200&format=json'
        const r = await fetch(url)
        if (!r.ok) throw new Error(`Commons API ${r.status}`)
        const j = await r.json()
        const pages = Object.values((j.query && j.query.pages) || {})
        for (const p of pages) {
            const ii = p.imageinfo && p.imageinfo[0]
            if (ii && /image\/(jpeg|png)/.test(ii.mime || '')) {
                const thumb = ii.thumburl || ii.url
                if (thumb) return { imgUrl: thumb, originalUrl: ii.url, title: p.title }
            }
        }
        return null
    })
}

function downloadWithCurl(url) {
    return new Promise((resolve, reject) => {
        let attempt = 0
        const run = () => {
            execFile(
                CURL_BIN,
                ['-s', '-L', '--max-time', '45', '-H', 'User-Agent: NeuroGalleryCurator/1.0 (educational gallery)', '--fail', '-o', '-', url],
                { encoding: 'buffer', maxBuffer: 60 * 1024 * 1024 },
                (err, stdout) => {
                    if (err || !stdout || stdout.length < 1000) {
                        if (attempt++ < 2) return setTimeout(run, 800)
                        return reject(new Error('图片下载失败: ' + (err ? err.message : '内容为空')))
                    }
                    resolve(stdout)
                }
            )
        }
        run()
    })
}

// Returns { buffer, ext, source, sourceTitle } for a real, searched image.
// Tries the scaled thumbnail first, then falls back to the original file.
async function fetchRealImage(query) {
    const found = await searchCommonsImage(query)
    if (!found) throw new Error('Commons 未找到合适的真实图片')
    const candidates = [found.imgUrl, found.originalUrl].filter(Boolean)
    let buf = null
    for (const u of candidates) {
        try {
            buf = await downloadWithCurl(u)
            if (buf) break
        } catch {
            // try the next candidate (e.g. the original file)
        }
    }
    if (!buf) throw new Error('图片下载失败')
    const m = (found.imgUrl || '').match(/\.(jpe?g|png)(?:[?#]|$)/i)
    const ext = m ? (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()) : 'jpg'
    return { buffer: buf, ext, source: found.imgUrl, sourceTitle: found.title }
}

function extractJSONArray(text) {
    // Strip markdown code fences if present.
    let s = text.trim()
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence) s = fence[1].trim()
    // Find the first '[' ... last ']'.
    const start = s.indexOf('[')
    const end = s.lastIndexOf(']')
    if (start !== -1 && end !== -1 && end > start) {
        s = s.slice(start, end + 1)
    }
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) return parsed
    // Maybe wrapped in an object.
    for (const v of Object.values(parsed)) {
        if (Array.isArray(v)) return v
    }
    throw new Error('No array found in model output')
}

function isURL(v) {
    return typeof v === 'string' && /^https?:\/\//i.test(v.trim())
}

async function curate({ theme, count = 6, language = '中文' }, res) {
    count = Math.max(1, Math.min(6, parseInt(count, 10) || 6))

    logLine(res, { type: 'log', step: 'init', message: `主题：「${theme}」 数量：${count} 语言：${language}` })

    // 1) Make sure the gallery (and its backend) is running.
    logLine(res, { type: 'log', step: 'start', message: '启动 / 检查现有画廊与后端…' })
    const started = await ensureGallery()
    if (!started) {
        logLine(res, { type: 'error', message: '无法启动画廊服务（localhost:5173）。' })
        return
    }
    logLine(res, { type: 'log', step: 'start', message: '后端已就绪，调用文字 AI 策划展览…' })

    // 2) Use the text AI (existing backend) to plan real exhibits for the theme.
    // The AI only curates *facts* (titles, accurate descriptions, real links);
    // the actual images are sourced from Wikimedia Commons by searching, never
    // AI-generated.
    const system =
        'You are an expert museum/gallery curator. Given a theme, you design a ' +
        'coherent, engaging exhibition using REAL, well-known subjects only. ' +
        'You respond ONLY with valid JSON (no markdown, no commentary).'
    const userPrompt =
        `Theme: ${theme}\n` +
        `Exhibit descriptions language: ${language}\n` +
        `Number of exhibits: ${count}\n` +
        `Produce a JSON array of exactly ${count} objects, each with keys:\n` +
        `- "title": the REAL name of a well-known subject/exhibit fitting the theme (string)\n` +
        `- "aiModel": a short medium/tech tag, e.g. "Photograph", "Painting", "Satellite image" (string)\n` +
        `- "prompt": 1-2 sentence museum wall-label description in ${language}, factually accurate and based on real public knowledge (string)\n` +
        `- "imageQuery": a concise ENGLISH search phrase to find a REAL photo/image of this subject on Wikimedia Commons (e.g. "Hubble Space Telescope", "Starry Night painting") (string)\n` +
        `- "repoUrl": a specific real public URL (Wikipedia/encyclopedia/official site) for this subject, or null if none (string|null)\n` +
        `Use only real, verifiable subjects. Do NOT invent. Return ONLY the JSON array.`

    let plan
    try {
        const text = await callBackendText(userPrompt, system)
        plan = extractJSONArray(text)
    } catch (e) {
        logLine(res, { type: 'error', message: `策划失败：${e.message}` })
        return
    }
    plan = plan.slice(0, count)
    logLine(res, { type: 'log', step: 'plan', message: `已生成 ${plan.length} 个展品方案，开始生成画作…` })

    // 3) For each exhibit, search & download a REAL image from Wikimedia
    //    Commons (never AI-generated) and save it into the paintings folder.
    await mkdir(PAINTINGS_DIR, { recursive: true })
    const items = []
    for (let i = 0; i < plan.length; i++) {
        const p = plan[i] || {}
        const idx = i + 1
        logLine(res, { type: 'log', step: 'image', message: `(${idx}/${plan.length}) 搜索真实图片：${p.title || '未命名'}` })
        let real
        try {
            real = await fetchRealImage(p.imageQuery || p.title || theme)
        } catch (e) {
            logLine(res, { type: 'log', step: 'image', message: `(${idx}) 未找到真实图片，跳过：${e.message}` })
            continue
        }
        const file = `picture${idx}.${real.ext}`
        const out = join(PAINTINGS_DIR, file)
        await writeFile(out, real.buffer)
        // Remove stale variants of the same slot.
        for (const e of ['png', 'jpg', 'jpeg']) {
            const stale = join(PAINTINGS_DIR, `picture${idx}.${e}`)
            if (existsSync(stale) && stale !== out) {
                try {
                    await rm(stale)
                } catch {
                }
            }
        }
        items.push({
            id: `p${idx}`,
            title: p.title || `展品 ${idx}`,
            aiModel: p.aiModel || 'Photograph',
            prompt: p.prompt || '',
            ...(isURL(p.repoUrl) ? { repoUrl: p.repoUrl.trim() } : {}),
            imageFile: `textures/paintings/${file}`,
            source: real.source,
            sourceTitle: real.sourceTitle,
            position: POSITIONS[i]
        })
        logLine(res, { type: 'log', step: 'image', message: `(${idx}) 已保存 ${file}（来源：${real.sourceTitle}）` })
    }

    if (items.length === 0) {
        logLine(res, { type: 'error', message: '没有成功生成任何画作，已取消更新展览。' })
        return
    }

    // 4) Backup & rewrite painting_data.json (the single gallery config).
    try {
        const prev = await readFile(CONFIG_FILE, 'utf8')
        await writeFile(join(PAINTINGS_DIR, 'painting_data.backup.json'), prev)
    } catch {
    }
    await writeFile(CONFIG_FILE, JSON.stringify(items, null, 4))

        // 5) Refresh the gallery so it loads the fresh config.
        logLine(res, { type: 'log', step: 'restart', message: '配置已写入，画廊正在自动加载新展览…' })
        const ok = await refreshGallery()
    logLine(res, {
        type: 'done',
        ok,
        theme,
        count: items.length,
        galleryUrl: GALLERY,
        message: ok ? '展览已生成并启动！' : '配置已写入，但画廊重启未完成，请稍后刷新。'
    })
}

// ---------------- HTTP server ----------------
const server = http.createServer(async (req, res) => {
    // CORS (curator page may be opened from another origin)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
        res.statusCode = 204
        return res.end()
    }

    if (req.method === 'POST' && req.url === '/api/curate') {
        let body = ''
        for await (const chunk of req) body += chunk
        let params = {}
        try {
            params = JSON.parse(body || '{}')
        } catch {
        }
        const theme = (params.theme || '').toString().trim()
        if (!theme) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: '`theme` is required.' }))
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no')
        // Run orchestration; stream NDJSON progress.
        curate(
            { theme, count: params.count, language: params.language || '中文' },
            res
        ).finally(() => res.end())
        return
    }

    if (req.method === 'GET' && req.url === '/api/status') {
        const backend = await httpOK(`${BACKEND}/api/health`).catch(() => false)
        const gallery = await httpOK(GALLERY).catch(() => false)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ backend, gallery, galleryUrl: GALLERY }))
    }

    // Serve the curator page.
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        try {
            const html = await readFile(join(__dirname, 'public', 'index.html'), 'utf8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            return res.end(html)
        } catch {
            res.statusCode = 500
            return res.end('curator page missing')
        }
    }

    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(CURATOR_PORT, () => {
    console.log(`[curator] Exhibition curator running at http://localhost:${CURATOR_PORT}`)
})
