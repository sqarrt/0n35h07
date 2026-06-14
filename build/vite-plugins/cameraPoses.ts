import type { Plugin, ViteDevServer } from 'vite'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { sendJson, readBody } from './shared'

/**
 * Dev-only мостик редактора камер фона меню (клавиша J в MenuBackdrop).
 *   GET /__camera-poses → текущее содержимое файла (свежие позы: файл исключён из вотчера,
 *     модульный кэш Vite может отдавать вкладкам устаревший JSON — клиент перечитывает на старте)
 *   PUT /__camera-poses → перезаписать src/components/menuCameraPoses.json телом запроса.
 */
const POSES_FILE = path.resolve(process.cwd(), 'src/components/menuCameraPoses.json')

export function cameraPoses(): Plugin {
  return {
    name: 'camera-poses',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__camera-poses', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const buf = await fs.readFile(POSES_FILE, 'utf8')
            res.setHeader('content-type', 'application/json')
            res.end(buf)
            return
          }
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
