import type { Role, StemLibrary } from './types'
import { ROLES } from './types'

// Vite: собираем все рендер-стемы как URL. Роль = имя папки (см. музыкальную память проекта).
const modules = import.meta.glob('../../assets/music/*/*.opus', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>

function buildLibrary(): StemLibrary {
  const lib: StemLibrary = { bass: [], kicks: [], lead: [], sfx: [] }
  for (const [path, url] of Object.entries(modules)) {
    const m = path.match(/\/music\/([^/]+)\/([^/]+)\.opus$/)
    if (!m) continue
    const role = m[1] as Role
    if (!ROLES.includes(role)) continue
    lib[role].push({ id: `${role}/${m[2]}`, url })
  }
  // Стабильный порядок по id → одинаковые индексы выбора у обоих пиров и между сборками.
  for (const role of ROLES) lib[role].sort((a, b) => a.id.localeCompare(b.id))
  return lib
}

export const STEM_LIBRARY: StemLibrary = buildLibrary()
