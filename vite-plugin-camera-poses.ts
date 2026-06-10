import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Dev-only мостик редактора камер фона меню (клавиша J в MenuBackdrop).
 * PUT /__camera-poses → перезаписать src/components/menuCameraPoses.json телом запроса
 * (клиент шлёт полный объект поз; Vite HMR подхватывает файл сам).
 */
const POSES_FILE = path.resolve(process.cwd(), 'src/components/menuCameraPoses.json')

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

export function cameraPoses(): Plugin {
  return {
    name: 'camera-poses',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__camera-poses', async (req, res) => {
        try {
          if (req.method !== 'PUT') return sendJson(res, 405, { error: 'method not allowed' })
          const body = await readBody(req)
          JSON.parse(body)   // валидация: тело обязано быть корректным JSON
          await fs.writeFile(POSES_FILE, body, 'utf8')
          return sendJson(res, 200, { ok: true })
        } catch (e) {
          return sendJson(res, 500, { error: String(e) })
        }
      })
    },
  }
}
