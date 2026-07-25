/**
 * Vercel Serverless Function: Health check
 * Returns the service status and whether the API key is configured.
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).json({
        ok: true,
        hasKey: !!process.env.AGNES_API_KEY,
        service: 'neurogallery-api'
    })
}
