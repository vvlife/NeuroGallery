/**
 * Vercel Serverless Function: AI text generation proxy
 * 
 * Supports two modes:
 * 1. Server-side key (AGNES_API_KEY env var) — shared across all users
 * 2. User-provided key (X-User-Api-Key header) — per-user, stored in browser localStorage
 * 
 * User-provided keys take precedence over the server-side key.
 */

const BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_MODEL = 'agnes-2.0-flash'

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key')

    if (req.method === 'OPTIONS') {
        return res.status(204).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Use user-provided key if available, otherwise fall back to server key
    const userKey = req.headers['x-user-api-key']
    const apiKey = userKey || process.env.AGNES_API_KEY

    if (!apiKey) {
        return res.status(500).json({
            error: 'No API key available. Set AGNES_API_KEY on the server, or provide your own key via the settings panel.'
        })
    }

    const { prompt, system, model } = req.body || {}

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: '`prompt` is required.' })
    }

    const messages = []
    if (system && typeof system === 'string') {
        messages.push({ role: 'system', content: system })
    }
    messages.push({ role: 'user', content: prompt })

    try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 9000)

        const upstream = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || DEFAULT_MODEL,
                messages,
                temperature: 0.7
            })
        })

        clearTimeout(timer)

        if (!upstream.ok) {
            const txt = await upstream.text()
            return res.status(upstream.status).json({
                error: `Upstream error ${upstream.status}: ${txt.slice(0, 300)}`
            })
        }

        const result = await upstream.json()
        const text = result?.choices?.[0]?.message?.content || ''
        return res.status(200).json({ text })
    } catch (err) {
        const msg = err.name === 'AbortError' ? 'Request timed out (9s limit)' : err.message
        return res.status(500).json({ error: `Proxy error: ${msg}` })
    }
}
