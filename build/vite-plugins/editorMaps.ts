import type { Plugin, ViteDevServer } from 'vite'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { sendJson, readBody } from './shared'

/**
 * Dev-only bridge for the map editor. Each map is a folder src/maps/<id>/ with files raw.json / geo.json / preview.png.
 * Endpoints (only under `vite serve`, the editor is dev-only anyway):
 *   GET    /__maps                 → ["id", ...] (folders that contain raw.json)
 *   GET    /__maps/<id>/<part>     → file contents (preview.png — binary)
 *   PUT    /__maps/<id>/<part>     → write file (preview.png — base64 body)
 *   DELETE /__maps/<id>            → delete the map folder
 * part ∈ { raw.json, geo.json, preview.png }.
 */
const MAPS_DIR = path.resolve(process.cwd(), 'src/maps')
const ID_RE = /^[a-zA-Z0-9_-]+$/
const PARTS = new Set(['raw.json', 'geo.json', 'preview.png'])
const CT: Record<string, string> = { 'raw.json': 'application/json', 'geo.json': 'application/json', 'preview.png': 'image/png' }

export function editorMaps(): Plugin {
  return {
    name: 'editor-maps',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__maps', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const segs = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)  // [] | [id] | [id, part]
        try {
          // Map list.
          if (req.method === 'GET' && segs.length === 0) {
            await fs.mkdir(MAPS_DIR, { recursive: true })
            const entries = await fs.readdir(MAPS_DIR, { withFileTypes: true })
            const ids: string[] = []
            for (const e of entries) {
              if (e.isDirectory() && await fs.access(path.join(MAPS_DIR, e.name, 'raw.json')).then(() => true, () => false)) ids.push(e.name)
            }
            return sendJson(res, 200, ids.sort())
          }

          const [id, part] = segs
          if (!ID_RE.test(id ?? '')) return sendJson(res, 400, { error: 'bad id' })
          const dir = path.join(MAPS_DIR, id)

          // Delete the entire map.
          if (req.method === 'DELETE' && segs.length === 1) {
            await fs.rm(dir, { recursive: true, force: true })
            return sendJson(res, 200, { ok: true })
          }

          if (!part || !PARTS.has(part)) return sendJson(res, 400, { error: 'bad part' })
          const file = path.join(dir, part)

          if (req.method === 'GET') {
            const buf = await fs.readFile(file).catch(() => null)
            if (buf == null) return sendJson(res, 404, { error: 'not found' })
            res.setHeader('content-type', CT[part])
            res.end(buf)
            return
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await fs.mkdir(dir, { recursive: true })
            // preview.png arrives as base64; everything else is text.
            await fs.writeFile(file, part === 'preview.png' ? Buffer.from(body, 'base64') : body, part === 'preview.png' ? undefined : 'utf8')
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
