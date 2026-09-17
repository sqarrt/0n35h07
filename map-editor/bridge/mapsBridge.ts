import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Dev-only bridge between the editor and the game's own files (the web build kept each map in a folder of its own;
 * the Godot project keeps them flat, and the preview lives with the other assets):
 *   raw.json     → ../maps/<id>.map           (imported into a JsonPack; read by nodes/map_files.gd)
 *   geo.json     → ../maps/<id>.geo           (imported into a MapGeo; read by nodes/geo_loader.gd)
 *   preview.png  → ../assets/maps/previews/<id>.png   (read by nodes/map_background.gd, nodes/map_tile.gd)
 *   backup.json  → .backups/<id>.json         (the editor's REVERT copy — not part of the game)
 *
 * Endpoints (serve only):
 *   GET    /__maps                 → ["id", ...]
 *   GET    /__maps/<id>/<part>     → file contents (preview.png — binary)
 *   PUT    /__maps/<id>/<part>     → write the file (preview.png — base64 body)
 *   POST   /__maps/<id>?rename=<to> → move all of the map's files to the new id
 *   DELETE /__maps/<id>            → delete the map's three files
 *   GET    /__recompile            → regenerate every map's perimeter walls and geo through the real pipeline
 */
const PROJECT = path.resolve(process.cwd(), '..')          // the Godot project: map-editor/ sits inside it
const MAPS_DIR = path.join(PROJECT, 'maps')
const PREVIEW_DIR = path.join(PROJECT, 'assets', 'maps', 'previews')
const BACKUP_DIR = path.resolve(process.cwd(), '.backups')
const CATALOG = path.join(PROJECT, 'sim', 'map_catalog.gd')   // the lobby's list of maps, kept in step from here
const CATALOG_RE = /^const MAP_IDS := \[(.*)\]$/m
const GEO_SUFFIX = '.geo'    // the game imports these two: sim/map_catalog.gd GEO_SUFFIX / RAW_SUFFIX
const RAW_SUFFIX = '.map'
const ID_RE = /^[a-zA-Z0-9_-]+$/
const DEFAULT_WALL_COLOR = '#5a6678'
const PARTS = new Set(['raw.json', 'geo.json', 'preview.png', 'backup.json'])
const CT: Record<string, string> = {
  'raw.json': 'application/json', 'geo.json': 'application/json',
  'preview.png': 'image/png', 'backup.json': 'application/json',
}

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

/** Where a map's `part` lives in the game (or in the editor's own backups). */
function fileOf(id: string, part: string): string {
  if (part === 'raw.json') return path.join(MAPS_DIR, id + RAW_SUFFIX)
  if (part === 'geo.json') return path.join(MAPS_DIR, id + GEO_SUFFIX)
  if (part === 'preview.png') return path.join(PREVIEW_DIR, `${id}.png`)
  return path.join(BACKUP_DIR, `${id}.json`)
}

/** The ids with a raw map file (a map the editor can open). */
async function listIds(): Promise<string[]> {
  await fs.mkdir(MAPS_DIR, { recursive: true })
  const files = await fs.readdir(MAPS_DIR)
  return files
    .filter(f => f.endsWith(RAW_SUFFIX))
    .map(f => f.slice(0, -RAW_SUFFIX.length))
    .sort()
}

/**
 * The lobby lists the maps of `MAP_IDS` in sim/map_catalog.gd (the web build kept the same hand-written list). The
 * editor keeps it in step: `edit` gets the current ids and returns the ones to write. Order is the lobby's order, so
 * a rename keeps its place and a new map goes last.
 */
async function editCatalog(edit: (ids: string[]) => string[]): Promise<void> {
  const source = await fs.readFile(CATALOG, 'utf8').catch(() => null)
  const line = source?.match(CATALOG_RE)
  if (!source || !line) {
    console.warn('  [map-editor] sim/map_catalog.gd has no MAP_IDS line — the lobby list was left alone.')
    return
  }
  const ids = line[1].split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
  const next = edit([...ids])
  if (next.join() === ids.join()) return
  const written = `const MAP_IDS := [${next.map(id => `"${id}"`).join(', ')}]`
  await fs.writeFile(CATALOG, source.replace(line[0], written), 'utf8')
  console.log(`  [map-editor] sim/map_catalog.gd → ${next.join(', ')}`)
}

const registerMap = (id: string) => editCatalog(ids => ids.includes(id) ? ids : [...ids, id])
const unregisterMap = (id: string) => editCatalog(ids => ids.filter(each => each !== id))
const renameInCatalog = (from: string, to: string) =>
  editCatalog(ids => ids.includes(from) ? ids.map(each => each === from ? to : each) : [...ids, to])

export function mapsBridge(): Plugin {
  return {
    name: 'map-editor-bridge',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // Bring every map up to date through the real pipeline (ssrLoadModule): swap the perimeter:true blocks for
      // freshly generated ones (current perimeter() geometry), keep every cover block verbatim (no voxelize → no
      // risk of losing blocks), then recompile the geometry.
      server.middlewares.use('/__recompile', async (_req, res) => {
        try {
          const mgc = await server.ssrLoadModule('/src/game/mapGeometryCache.ts') as {
            compileBlocks: (blocks: unknown[]) => unknown
            serializeGeo: (c: unknown) => string
          }
          const gm = await server.ssrLoadModule('/src/game/maps.ts') as {
            perimeter: (color: string, hx: number, hz: number) => Array<{ color: string }>
          }
          const done: string[] = []
          const failed: string[] = []
          for (const id of await listIds()) {
            try {
              const rawStr = await fs.readFile(fileOf(id, 'raw.json'), 'utf8')
              const map = JSON.parse(rawStr) as { half: [number, number]; blocks: Array<{ perimeter?: boolean; color: string }> }
              const cover = map.blocks.filter(b => b.perimeter !== true)
              const wallColor = map.blocks.find(b => b.perimeter === true)?.color ?? DEFAULT_WALL_COLOR
              const blocks = [...gm.perimeter(wallColor, map.half[0], map.half[1]), ...cover]
              await fs.writeFile(fileOf(id, 'raw.json'), JSON.stringify({ ...map, blocks }, null, 2), 'utf8')
              await fs.writeFile(fileOf(id, 'geo.json'), mgc.serializeGeo(mgc.compileBlocks(blocks)), 'utf8')
              done.push(id)
            } catch { failed.push(id) }   // one bad map (say, mid-write) must not abort the rest
          }
          return sendJson(res, 200, { recompiled: done, failed })
        } catch (err) {
          return sendJson(res, 500, { error: String(err) })
        }
      })

      server.middlewares.use('/__maps', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const segs = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)  // [] | [id] | [id, part]
        try {
          if (req.method === 'GET' && segs.length === 0) return sendJson(res, 200, await listIds())

          const [id, part] = segs
          if (!ID_RE.test(id ?? '')) return sendJson(res, 400, { error: 'bad id' })

          if (req.method === 'POST' && segs.length === 1) {
            const to = url.searchParams.get('rename') ?? ''
            if (!ID_RE.test(to)) return sendJson(res, 400, { error: 'bad name' })
            if (await fs.access(fileOf(to, 'raw.json')).then(() => true, () => false)) {
              return sendJson(res, 409, { error: 'name taken' })
            }
            for (const each of ['raw.json', 'geo.json', 'preview.png', 'backup.json']) {
              await fs.rename(fileOf(id, each), fileOf(to, each)).catch(() => {})   // a part may not exist yet
            }
            await renameInCatalog(id, to)
            return sendJson(res, 200, { ok: true })
          }

          if (req.method === 'DELETE' && segs.length === 1) {
            for (const each of ['raw.json', 'geo.json', 'preview.png', 'backup.json']) {
              await fs.rm(fileOf(id, each), { force: true })
            }
            await unregisterMap(id)
            return sendJson(res, 200, { ok: true })
          }

          if (!part || !PARTS.has(part)) return sendJson(res, 400, { error: 'bad part' })
          const file = fileOf(id, part)

          if (req.method === 'GET') {
            const buf = await fs.readFile(file).catch(() => null)
            if (buf == null) return sendJson(res, 404, { error: 'not found' })
            res.setHeader('content-type', CT[part])
            res.end(buf)
            return
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await fs.mkdir(path.dirname(file), { recursive: true })
            // preview.png arrives as base64; everything else is text.
            const binary = part === 'preview.png'
            await fs.writeFile(file, binary ? Buffer.from(body, 'base64') : body, binary ? undefined : 'utf8')
            if (part === 'raw.json') await registerMap(id)
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
