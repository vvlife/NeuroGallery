import {defineConfig} from 'vite'
import {spawn} from 'node:child_process'
import net from 'node:net'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Returns true if something is already listening on the given TCP port.
function portInUse(port) {
    return new Promise((resolve) => {
        const s = net.connect(port, '127.0.0.1')
        s.setTimeout(800)
        s.on('connect', () => {
            s.destroy()
            resolve(true)
        })
        s.on('error', () => resolve(false))
        s.on('timeout', () => {
            s.destroy()
            resolve(false)
        })
    })
}

// Launch a child Node process (backend or curator) only if its port is free,
// so running `npm run curator` manually AND `npm run dev` won't double-spawn.
function spawnIfFree(command, args, port, env) {
    return portInUse(port).then((inUse) => {
        if (inUse) return null
        const child = spawn(command, args, {env: {...process.env, ...env}, stdio: 'inherit'})
        const close = () => {
            try {
                child.kill()
            } catch {
            }
        }
        return child
    })
}

// Launch the backend image-proxy (server/index.js) whenever Vite runs in
// dev or preview mode, and forward /api/* to it. This keeps `npm run dev`
// a single command while the API key stays server-side only.
function backendServerPlugin() {
    const start = async (server) => {
        const child = await spawnIfFree(process.execPath, ['server/index.js'], 3001, {PORT: '3001'})
        const close = () => {
            try {
                child?.kill()
            } catch {
            }
        }
        server.httpServer?.on('close', close)
        server.on?.('close', close)
    }

    return {
        name: 'backend-dev-server',
        configureServer(server) {
            start(server)
        },
        configurePreviewServer(server) {
            start(server)
        }
    }
}

// Launch the exhibition curator (curator/server.js) and expose it under the
// SAME origin as the gallery (port 5173) so the browser preview can relay
// every request (including POST /curator-api/curate) without cross-origin
// or localhost-mismatch failures. The page is served at /curator and the
// API is proxied from /curator-api/* to http://localhost:4000/api/*.
function curatorServerPlugin() {
    const CURATOR_HTML = readFileSync(join(__dirname, 'curator', 'public', 'index.html'))

    const start = async (server) => {
        const child = await spawnIfFree(
            '/Users/nxhuang/.workbuddy/binaries/node/versions/22.22.2/bin/node',
            ['curator/server.js'],
            4000,
            {CURATOR_PORT: '4000'}
        )
        const close = () => {
            try {
                child?.kill()
            } catch {
            }
        }
        server.httpServer?.on('close', close)
        server.on?.('close', close)
    }

    const servePage = (req, res, next) => {
        if (req.method === 'GET' && (req.url === '/' || req.url === '' || req.url === '/index.html')) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(CURATOR_HTML)
            return
        }
        next()
    }

    return {
        name: 'curator-dev-server',
        configureServer(server) {
            start(server)
            server.middlewares.use('/curator', servePage)
        },
        configurePreviewServer(server) {
            start(server)
            server.middlewares.use('/curator', servePage)
        }
    }
}

export default defineConfig({
    plugins: [backendServerPlugin(), curatorServerPlugin()],

    // Base path for production
    base: './',

    // Development server config
    server: {
        host: true,
        port: 5173,
        strictPort: true,
        open: false,
        proxy: {
            // Curator API (exhibition orchestration) — same origin as gallery.
            '/curator-api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/curator-api/, '/api')
            },
            // Forward AI image/text requests to the local backend proxy.
            '/api': 'http://localhost:3001'
        }
    },

    // Build optimizations
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    'lil-gui': ['lil-gui']
                }
            }
        }
    },

    // Asset handling
    assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.mp3'],

    // Optimize dependencies
    optimizeDeps: {
        include: ['three', 'lil-gui']
    },

    // Public directory
    publicDir: 'public'
})
