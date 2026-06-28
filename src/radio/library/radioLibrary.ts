// The radio's on-disk track library — a thin, TESTABLE layer over a filesystem abstraction (`FsLike`). The real
// Tauri-backed FsLike lives in tauriFs.ts (kept separate so this module — and its unit tests — pull in NO Tauri
// imports). All paths here are LIBRARY-RELATIVE to the radio root ('' = root, 'Folder', 'Folder/Track.json').

const TRACK_EXT = '.json'
const TRASH_FILE = '_trash.json' // hidden control file at the root — the blocked-track list; never shown as an entry
const HIDDEN_PREFIX = '_'        // entries starting with '_' (and the migration marker '.') are control files, hidden

/** The filesystem operations the library needs. The real impl wraps @tauri-apps/plugin-fs; tests pass an in-memory mock. */
export interface FsLike {
  mkdir(path: string): Promise<void>
  readDir(path: string): Promise<{ name: string; isDirectory: boolean }[]>
  readTextFile(path: string): Promise<string>
  writeTextFile(path: string, contents: string): Promise<void>
  remove(path: string, opts?: { recursive?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
  rename(from: string, to: string): Promise<void>
}

/** A baked track section (frozen Strudel) — mirrors the radio's BakedSection. */
export interface BakedSection { code: string; bars: number }

/** What a `<name>.json` track file contains: identity + display meta + the frozen render. */
export interface TrackPayload {
  v: 1
  seed: string
  index: number
  name: string
  mood: string
  key: string
  scaleName: string
  bpm: number
  style: { kick: string; bass: string; lead: string; bg: string; perc: string }
  baked: { name: string; sections: BakedSection[] }
}

/** One row in a folder listing. */
export type LibEntry =
  | { kind: 'folder'; name: string; path: string }
  | { kind: 'track'; name: string; path: string }

export interface TrashData { blocked: string[] } // ids are "<seed>:<index>"

/** A track's stable block id (what the trash stores). */
export function trackId(seed: string, index: number): string { return `${seed}:${index}` }

function join(dir: string, name: string): string { return dir ? `${dir}/${name}` : name }
function sanitizeName(name: string): string {
  // strip path separators / illegal filename chars so a track name can't escape its folder
  return name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'track'
}

export class RadioLibrary {
  private fs: FsLike
  constructor(fs: FsLike) { this.fs = fs }

  /** Ensure the root folder exists (idempotent). */
  async ensureRoot(): Promise<void> { await this.fs.mkdir('') }

  /** Folders + track files in `dir` (control files hidden). Folders first, then tracks, both name-sorted. */
  async listDir(dir: string): Promise<LibEntry[]> {
    const raw = await this.fs.readDir(dir)
    const folders: LibEntry[] = []
    const tracks: LibEntry[] = []
    for (const e of raw) {
      if (e.name.startsWith(HIDDEN_PREFIX) || e.name.startsWith('.')) continue
      if (e.isDirectory) folders.push({ kind: 'folder', name: e.name, path: join(dir, e.name) })
      else if (e.name.endsWith(TRACK_EXT)) tracks.push({ kind: 'track', name: e.name.slice(0, -TRACK_EXT.length), path: join(dir, e.name) })
    }
    const byName = (a: LibEntry, b: LibEntry) => a.name.localeCompare(b.name)
    return [...folders.sort(byName), ...tracks.sort(byName)]
  }

  /** Read + parse a track file. */
  async readTrack(path: string): Promise<TrackPayload> {
    return JSON.parse(await this.fs.readTextFile(path)) as TrackPayload
  }

  /** Write a track into `folder` as `<name>.json`; a name collision gets a ` (2)`/`(3)` suffix. Returns the path. */
  async saveTrack(folder: string, payload: TrackPayload): Promise<string> {
    const base = sanitizeName(payload.name)
    const path = await this.freePath(folder, base, TRACK_EXT)
    await this.fs.writeTextFile(path, JSON.stringify(payload, null, 2))
    return path
  }

  async deleteTrack(path: string): Promise<void> { await this.fs.remove(path) }

  /** Create a subfolder (collision-safe). Returns its path. */
  async makeFolder(parent: string, name: string): Promise<string> {
    const path = await this.freePath(parent, sanitizeName(name), '')
    await this.fs.mkdir(path)
    return path
  }

  /** Move a track file into `destFolder` (collision-safe). Returns the new path. */
  async moveTrack(path: string, destFolder: string): Promise<string> {
    const file = path.slice(path.lastIndexOf('/') + 1)
    const base = file.endsWith(TRACK_EXT) ? file.slice(0, -TRACK_EXT.length) : file
    const dest = await this.freePath(destFolder, base, TRACK_EXT)
    if (dest === path) return path
    await this.fs.rename(path, dest)
    return dest
  }

  /** First non-colliding `<dir>/<base><suffix>ext` ("", " (2)", " (3)"…). */
  private async freePath(dir: string, base: string, ext: string): Promise<string> {
    for (let i = 1; ; i++) {
      const name = (i === 1 ? base : `${base} (${i})`) + ext
      const path = join(dir, name)
      if (!(await this.fs.exists(path))) return path
    }
  }

  // ── trash (the "never appears again" block list) ──────────────────────────────────────────────────
  async trashList(): Promise<string[]> {
    if (!(await this.fs.exists(TRASH_FILE))) return []
    try { return (JSON.parse(await this.fs.readTextFile(TRASH_FILE)) as TrashData).blocked ?? [] }
    catch { return [] }
  }

  async trashAdd(id: string): Promise<void> {
    const blocked = await this.trashList()
    if (blocked.includes(id)) return
    blocked.push(id)
    await this.fs.writeTextFile(TRASH_FILE, JSON.stringify({ blocked } satisfies TrashData, null, 2))
  }

  async trashHas(id: string): Promise<boolean> { return (await this.trashList()).includes(id) }
}
