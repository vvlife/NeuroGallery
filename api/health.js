/**
 * Vercel Serverless Function: Health check
 * Returns service status and whether the server-side API key is configured.
 * Even if hasKey is false, clients can use their own API key via X-User-Api-Key header.
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).json({
        ok: true,
        hasKey: !!process.env.AGNES_API_KEY,
        supportsUserKey: true,
        service: 'neurogallery-api'
    })
}
