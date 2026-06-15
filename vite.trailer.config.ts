import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, renameSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { TRAILER_SHOTS, CLIP_FILES } from './src/components/trailer/trailerEdl'
import pkg from './package.json'

/**
 * Сборка ЗАМОРОЖЕННОГО (immutable) трейлера в trailer-dist/ — независимая от остального проекта копия:
 * правки игры её не сломают. Сам этот конфиг и его плагин в артефакт НЕ попадают (конфиги не бандлятся,
 * плагин работает только на этапе сборки). Вся оптимизация — здесь, общий код не меняется: плагин подменяет
 * два модуля графа трейлера виртуальными,
 *  - trailerEdl: индексы кадров ремапятся под ОБРЕЗАННЫЕ демки (оставляем только показываемые кадры);
 *  - stems: вместо glob всех музыкальных стемов — только 4 используемых трейлером,
 * эмитит обрезанные демки в demos/ и переименовывает выходной html в index.html.
 *
 * Пересобрать копию: npm run build:trailer  →  закоммитить trailer-dist/. Просмотр: npx serve trailer-dist
 */
const ROOT = process.cwd()
const DEMO_SRC = resolve(ROOT, 'public/demos')

const VIRT_EDL = '\0virtual:trailer-edl'
const VIRT_STEMS = '\0virtual:trailer-stems'

// Музыка трейлера — только эти стемы (см. TrailerMusic). Пути root-относительные (кроссплатформенно).
const USED_STEMS: { id: string; role: 'kicks' | 'bass' | 'lead'; file: string }[] = [
  { id: 'kicks/sub_long', role: 'kicks', file: '/src/assets/music/kicks/sub_long.opus' },
  { id: 'bass/kutting', role: 'bass', file: '/src/assets/music/bass/kutting.opus' },
  { id: 'lead/crickets_tex', role: 'lead', file: '/src/assets/music/lead/crickets_tex.opus' },
  { id: 'lead/lwt_14', role: 'lead', file: '/src/assets/music/lead/lwt_14.opus' },
]

function trailerOptimize() {
  // Обрезаем каждую демку до объединения показываемых кадров и ремапим индексы EDL.
  const trimmed: Record<string, string> = {}
  const shots = JSON.parse(JSON.stringify(TRAILER_SHOTS)) as typeof TRAILER_SHOTS

  for (const [clipId, file] of Object.entries(CLIP_FILES)) {
    const demo = JSON.parse(readFileSync(resolve(DEMO_SRC, file), 'utf8'))
    const used = new Set<number>()
    for (const s of shots) {
      if (s.type === 'countdown' && s.clip === clipId) used.add(s.frame)
      if (s.type === 'play' && s.clip === clipId) for (const r of s.ranges) for (let i = r.from; i <= r.to; i++) used.add(i)
    }
    const sorted = [...used].sort((a, b) => a - b)
    const map = new Map(sorted.map((orig, ni) => [orig, ni]))
    demo.frames = sorted.map(i => demo.frames[i])
    trimmed[file] = JSON.stringify(demo)
    for (const s of shots) {
      if (s.type === 'countdown' && s.clip === clipId) s.frame = map.get(s.frame)!
      if (s.type === 'play' && s.clip === clipId) for (const r of s.ranges) { r.from = map.get(r.from)!; r.to = map.get(r.to)! }
    }
  }

  const edlSource =
    `export const CLIP_FILES = ${JSON.stringify(CLIP_FILES)};\n` +
    `export const TRAILER_SHOTS = ${JSON.stringify(shots)};\n`

  const stemsSource =
    USED_STEMS.map((s, i) => `import u${i} from '${s.file}?url';`).join('\n') + '\n' +
    `export const STEM_LIBRARY = { bass: [], kicks: [], lead: [], sfx: [] };\n` +
    USED_STEMS.map((s, i) => `STEM_LIBRARY.${s.role}.push({ id: '${s.id}', url: u${i} });`).join('\n') + '\n'

  return {
    name: 'trailer-optimize',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id === './trailerEdl' || id.endsWith('/trailerEdl')) return VIRT_EDL
      if (id === './stems' || id.endsWith('/stems')) return VIRT_STEMS
      return null
    },
    load(id: string) {
      if (id === VIRT_EDL) return edlSource
      if (id === VIRT_STEMS) return stemsSource
      return null
    },
    generateBundle() {
      // Обрезанные демки кладём в demos/ (без хэша имени — путь фиксирован в коде).
      for (const [file, source] of Object.entries(trimmed)) {
        // @ts-expect-error emitFile есть в контексте плагина-хука
        this.emitFile({ type: 'asset', fileName: `demos/${file}`, source })
      }
    },
    closeBundle() {
      // Выходной html → index.html (чтобы `npx serve trailer-dist` отдавал его по умолчанию).
      const out = resolve(ROOT, 'trailer-dist')
      if (existsSync(resolve(out, 'trailer.html'))) renameSync(resolve(out, 'trailer.html'), resolve(out, 'index.html'))
    },
  }
}

export default defineConfig({
  root: ROOT,
  base: './',
  publicDir: false,   // не копируем public/ (там полные демки/иконки) — нужное эмитим сами
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [trailerOptimize(), react()],
  build: {
    outDir: 'trailer-dist',
    emptyOutDir: true,
    rollupOptions: { input: resolve(ROOT, 'trailer.html') },
  },
})
