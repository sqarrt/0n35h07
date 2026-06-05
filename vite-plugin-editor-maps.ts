import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Dev-only мостик редактора карт: читает/пишет JSON-файлы карт в src/maps.
 * Эндпоинты (только при `vite serve`, редактор и так dev-only):
 *   GET    /__maps          → ["name", ...] (имена файлов без .json)
 *   GET    /__maps/<name>   → содержимое src/maps/<name>.json
 *   PUT    /__maps/<name>   → записать тело в src/maps/<name>.json
 *   DELETE /__maps/<name>   → удалить src/maps/<name>.json
 */
const MAPS_DIR = path.resolve(process.cwd(), 'src/maps')
const NAME_RE = /^[a-zA-Z0-9_-]+$/

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.statusCode = code
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export function editorMaps(): Plugin {
  return {
    name: 'editor-maps',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__maps', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const name = decodeURIComponent(url.pathname.replace(/^\//, ''))   // '' → список
        try {
          if (req.method === 'GET' && !name) {
            await fs.mkdir(MAPS_DIR, { recursive: true })
            const files = await fs.readdir(MAPS_DIR)
            return sendJson(res, 200, files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort())
          }
          if (!NAME_RE.test(name)) return sendJson(res, 400, { error: 'bad name' })
          const file = path.join(MAPS_DIR, `${name}.json`)
          if (req.method === 'GET') {
            const data = await fs.readFile(file, 'utf8').catch(() => null)
            if (data == null) return sendJson(res, 404, { error: 'not found' })
            res.setHeader('content-type', 'application/json')
            res.end(data)
            return
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await fs.mkdir(MAPS_DIR, { recursive: true })
            await fs.writeFile(file, body, 'utf8')
            return sendJson(res, 200, { ok: true })
          }
          if (req.method === 'DELETE') {
            await fs.unlink(file).catch(() => null)
            return sendJson(res, 200, { ok: true })
          }
          return sendJson(res, 405, { error: 'method not allowed' })
        } catch (e) {
          return sendJson(res, 500, { error: String(e) })
        }
      })
    },
  }
}
