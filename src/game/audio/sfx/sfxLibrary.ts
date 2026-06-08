import type { SfxEvent } from './types'

// Eager-манифест: путь → url ассета (Vite). Имя файла без .opus = id события.
const modules = import.meta.glob('../../../assets/sfx/*.opus', { eager: true, query: '?url', import: 'default' })

function buildLibrary(): Record<SfxEvent, string> {
  const lib = {} as Record<SfxEvent, string>
  for (const [path, url] of Object.entries(modules)) {
    const id = path.split('/').pop()!.replace('.opus', '') as SfxEvent
    lib[id] = url as string
  }
  return lib
}

export const SFX_LIBRARY: Record<SfxEvent, string> = buildLibrary()
