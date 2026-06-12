import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') })

const __dirname = dirname(fileURLToPath(import.meta.url))

function buildFakeRes(nodeRes) {
  let statusCode = 200
  const send = (data) => {
    if (!nodeRes.headersSent) {
      nodeRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
    }
    nodeRes.end(JSON.stringify(data))
  }
  nodeRes.status = (code) => { statusCode = code; return { json: send } }
  nodeRes.json = send
  nodeRes.setHeader = (k, v) => { try { nodeRes.setHeader(k, v) } catch {} }
  return nodeRes
}

function readJsonBody(req) {
  return new Promise((resolvePromise) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolvePromise(raw ? JSON.parse(raw) : undefined) }
      catch { resolvePromise(undefined) }
    })
  })
}

// Emula as serverless functions da Vercel em dev: /api/foo/bar → api/foo/bar.js
function localApiPlugin() {
  const apiDir = resolve(__dirname, 'api')
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()

        const urlObj = new URL(req.url, 'http://localhost')
        const relPath = urlObj.pathname.replace(/^\/api\//, '')
        if (!/^[\w/-]+$/.test(relPath)) return next()
        const handlerFile = resolve(apiDir, `${relPath}.js`)
        if (!handlerFile.startsWith(apiDir)) return next()

        const fakeRes = buildFakeRes(res)
        req.query = Object.fromEntries(urlObj.searchParams)
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          req.body = await readJsonBody(req)
        }

        try {
          const handlerUrl = pathToFileURL(handlerFile).href + `?t=${Date.now()}`
          const { default: handler } = await import(handlerUrl)
          await handler(req, fakeRes)
        } catch (err) {
          console.error('[local-api] Erro:', err)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: err.message }))
          }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: { port: 5174 },
})
