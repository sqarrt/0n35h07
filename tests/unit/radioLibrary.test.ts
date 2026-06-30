import { describe, it, expect } from 'vitest'
import { RadioLibrary, type FsLike, type TrackPayload } from '../../src/radio/library/radioLibrary'

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
  v: 2, id: 'seedA:3', name, bpm: 131, bars: 8,
  info: { mood: 'dread', key: 'E', scale: 'minor' },
  program: 'setcpm(131/4)\narrange(\n  // peak (8 bars)\n  [8, stack(note("0"))],\n)',
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
    expect(read.bpm).toBe(131)
    expect(read.program).toContain('arrange(')
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

  it('rejects a malformed track file (no program)', async () => {
    const fs = memFs()
    const lib = new RadioLibrary(fs)
    await fs.writeTextFile('Bad.json', JSON.stringify({ v: 2, id: 'x', name: 'Bad', bpm: 120 }))
    await expect(lib.readTrack('Bad.json')).rejects.toThrow()
  })
})
