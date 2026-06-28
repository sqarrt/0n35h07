import type { RadioLibrary, TrackPayload, BakedSection } from './radioLibrary'
import type { FavoriteTrack, TrackDescriptor } from '../trackDescriptor'

const MARKER = '.migrated' // hidden control file at the radio root → migration runs only once

/** One-time: turn the old localStorage favorites/dislikes into on-disk track files + the trash block-list.
 *  Favorites with no baked snapshot are baked on the fly. Idempotent (guarded by the .migrated marker). */
export async function migrateProfileToLibrary(
  lib: RadioLibrary,
  favorites: FavoriteTrack[],
  dislikes: TrackDescriptor[],
  bake: (seed: string, index: number) => BakedSection[],
): Promise<boolean> {
  if (await lib.hasMarker(MARKER)) return false
  for (const d of dislikes) await lib.trashAdd(`${d.seed}:${d.index}`)
  for (const f of favorites) {
    const sections = f.baked?.sections ?? bake(f.seed, f.index)
    if (!sections.length) continue
    const name = f.baked?.name ?? `${f.mood} ${f.bpm}`
    const payload: TrackPayload = {
      v: 1, seed: f.seed, index: f.index, name,
      mood: f.mood, key: f.key, scaleName: f.scaleName, bpm: f.bpm, style: f.style,
      baked: { name, sections },
    }
    await lib.saveTrack('', payload)
  }
  await lib.setMarker(MARKER)
  return true
}
