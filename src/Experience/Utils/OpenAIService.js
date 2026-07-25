/**
 * OpenAIService (frontend)
 * -------------------------
 * The frontend NEVER talks to the AI provider directly and holds NO API key.
 * It calls our own backend proxy at `/api/generate-image`, which forwards the
 * request to the configured provider and returns the image bytes.
 *
 * The backend base URL is configurable via public/textures/paintings/easel_config.json
 * (`apiBase` field). Default is `/api` (same-origin, used in local dev & when the
 * backend is deployed together with the frontend).
 */
export default class OpenAIService {
    constructor() {
        this.apiBase = '/api'
        this.configLoaded = false
    }

    /**
     * Lazily load the easel API base from the public config file.
     * Only `apiBase` is read here — never any secret.
     */
    async loadConfig() {
        if (this.configLoaded) return
        try {
            const res = await fetch('/textures/paintings/easel_config.json')
            if (res.ok) {
                const cfg = await res.json()
                if (cfg.apiBase && cfg.apiBase.trim() !== '') {
                    this.apiBase = cfg.apiBase.trim()
                }
            }
        } catch (e) {
            console.warn('[OpenAIService] Could not load easel_config.json, using default /api.', e)
        }
        this.configLoaded = true
    }

    /**
     * Request an AI-generated image from the backend proxy.
     * @param {string} prompt
     * @returns {Promise<string>} a blob object URL usable directly by THREE.TextureLoader
     */
    async generateImage(prompt) {
        await this.loadConfig()

        const res = await fetch(`${this.apiBase}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        })

        if (!res.ok) {
            let message = `Generation failed (HTTP ${res.status})`
            try {
                const err = await res.json()
                if (err && err.error) message = err.error
            } catch {
                // response was not JSON
            }
            throw new Error(message)
        }

        const blob = await res.blob()
        return URL.createObjectURL(blob)
    }
}
