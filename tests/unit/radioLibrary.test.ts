import { describe, it, expect } from 'vitest'
import { RadioLibrary, type FsLike, type TrackPayload } from '../../src/radio/library/radioLibrary'
import { migrateProfileToLibrary } from '../../src/radio/library/migrate'
import type { FavoriteTrack, TrackDescriptor } from '../../src/radio/trackDescriptor'

// In-memory FsLike — mirrors the real plugin-fs behaviour the library relies on (library-relative paths).
function memFs(): FsLike {
  const dirs = new Set<string>()
  const files = new Map<string, string>()
  return {
    async mkdir(p) { dirs.add(p) },
    async exists(p) { return dirs.has(p) || files.has(p) },
    async writeTextFile(p, c) { files.set(p, c) },
    async readTextFile(p) { const c = files.get(p); if (c === undefined) throw new Error('ENOENT ' + p); return c },
    async remove(p) {
      files.delete(p); dirs.delete(p)
      for (const k of [...files.keys()]) if (k.startsWith(p + '/')) files.delete(k)
      for (const d of [...dirs]) if (d.startsWith(p + '/')) dirs.delete(d)
    },
    async readDir(p) {
      const prefix = p === '' ? '' : p + '/'
      const out: { name: string; isDirectory: boolean }[] = []
      for (const f of files.keys()) if (f.startsWith(prefix)) { const rest = f.slice(prefix.length); if (rest && !rest.includes('/')) out.push({ name: rest, isDirectory: false }) }
      for (const d of dirs) if (d !== p && d.startsWith(prefix)) { const rest = d.slice(prefix.length); if (rest && !rest.includes('/')) out.push({ name: rest, isDirectory: true }) }
      return out
    },
    async rename(a, b) {
      const c = files.get(a); if (c !== undefined) { files.set(b, c); files.delete(a) }
      else if (dirs.has(a)) { dirs.add(b); dirs.delete(a) }
    },
  }
}

const mk = (name: string): TrackPayload => ({
  v: 1, seed: 'seedA', index: 3, name, mood: 'dread', key: 'E', scaleName: 'minor', bpm: 131,
  style: { kick: 'k', bass: 'tritone', lead: 'fogMelody', bg: 'tapeChoir', perc: 'broken' },
  baked: { name, sections: [{ code: 'note("0")', bars: 4 }] },
})

describe('RadioLibrary', () => {
  it('saves a track and lists/reads it back', async () => {
    const lib = new RadioLibrary(memFs())
    await lib.ensureRoot()
    const path = await lib.saveTrack('', mk('Ashen Drift'))
    expect(path).toBe('Ashen Drift.json')
    const entries = await lib.listDir('')
    expect(entries).toEqual([{ kind: 'track', name: 'Ashen Drift', path: 'Ashen Drift.json' }])
    const read = await lib.readTrack(path)
    expect(read.name).toBe('Ashen Drift')
    expect(read.style.bass).toBe('tritone')
  })

  it('suffixes a colliding track name', async () => {
    const lib = new RadioLibrary(memFs())
    await lib.saveTrack('', mk('Twin'))
    const p2 = await lib.saveTrack('', mk('Twin'))
    expect(p2).toBe('Twin (2).json')
  })

  it('makes a folder, lists folders before tracks, and moves a track in', async () => {
    const lib = new RadioLibrary(memFs())
    await lib.saveTrack('', mk('Loose'))
    const folder = await lib.makeFolder('', 'Night')
    expect(folder).toBe('Night')
    const top = await lib.listDir('')
    expect(top.map((e) => `${e.kind}:${e.name}`)).toEqual(['folder:Night', 'track:Loose'])
    await lib.moveTrack('Loose.json', 'Night')
    expect((await lib.listDir('')).map((e) => e.name)).toEqual(['Night'])
    expect((await lib.listDir('Night')).map((e) => e.name)).toEqual(['Loose'])
  })

  it('deletes a track', async () => {
    const lib = new RadioLibrary(memFs())
    await lib.saveTrack('', mk('Gone'))
    await lib.deleteTrack('Gone.json')
    expect(await lib.listDir('')).toEqual([])
  })

  it('trash: add/has/list, deduped, and not shown as a file entry', async () => {
    const lib = new RadioLibrary(memFs())
    await lib.saveTrack('', mk('Keep'))
    await lib.trashAdd('seedA:3')
    await lib.trashAdd('seedA:3') // dedupe
    await lib.trashAdd('seedB:7')
    expect(await lib.trashList()).toEqual(['seedA:3', 'seedB:7'])
    expect(await lib.trashHas('seedA:3')).toBe(true)
    expect(await lib.trashHas('nope:0')).toBe(false)
    // the _trash.json control file must NOT appear in the listing
    expect((await lib.listDir('')).map((e) => e.name)).toEqual(['Keep'])
  })

  it('renames a track and a folder (collision-safe)', async () => {
    const lib = new RadioLibrary(memFs())
    await lib.saveTrack('', mk('Old'))
    expect(await lib.rename('Old.json', 'New')).toBe('New.json')
    expect((await lib.listDir('')).map((e) => e.name)).toEqual(['New'])
    const f = await lib.makeFolder('', 'F')
    expect(await lib.rename(f, 'G')).toBe('G')
    expect((await lib.listDir('')).map((e) => `${e.kind}:${e.name}`)).toEqual(['folder:G', 'track:New'])
  })

  it('deletes a folder recursively', async () => {
    const lib = new RadioLibrary(memFs())
    const f = await lib.makeFolder('', 'Box')
    await lib.saveTrack(f, mk('Inside'))
    await lib.deleteTrack(f, true)
    expect(await lib.listDir('')).toEqual([])
  })

  it('migrates old favorites→files + dislikes→trash, once', async () => {
    const lib = new RadioLibrary(memFs())
    const style = { kick: '', bass: '', lead: '', bg: '', perc: '' }
    const fav: FavoriteTrack = { seed: 'S', index: 1, mood: 'dread', key: 'E', scaleName: 'minor', bpm: 130, style, baked: { name: 'Saved One', sections: [{ code: 'note("0")', bars: 4 }] } }
    const dis: TrackDescriptor = { seed: 'S', index: 2, mood: 'calm', key: 'A', scaleName: 'minor', bpm: 110, style }
    expect(await migrateProfileToLibrary(lib, [fav], [dis], () => [{ code: 'b', bars: 2 }])).toBe(true)
    expect((await lib.listDir('')).map((e) => e.name)).toEqual(['Saved One'])
    expect(await lib.trashHas('S:2')).toBe(true)
    expect(await migrateProfileToLibrary(lib, [fav], [], () => [])).toBe(false) // idempotent
  })
})
