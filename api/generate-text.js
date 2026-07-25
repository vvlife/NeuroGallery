/**
 * Vercel Serverless Function: AI text generation proxy
 * 
 * This endpoint acts as a lightweight proxy for text generation (chat completions).
 * The API key is stored as a Vercel environment variable (AGNES_API_KEY) and never
 * exposed to the client.
 * 
 * Usage:
 *   POST /api/generate-text
 *   Body: { "prompt": "...", "system": "...", "model": "..." }
 *   Response: { "text": "..." }
 */

const BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_MODEL = 'agnes-2.0-flash'

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(204).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const apiKey = process.env.AGNES_API_KEY
    if (!apiKey) {
        return res.status(500).json({ error: 'AGNES_API_KEY is not configured on the server.' })
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
        const timer = setTimeout(() => controller.abort(), 9000) // Vercel 10s limit

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
