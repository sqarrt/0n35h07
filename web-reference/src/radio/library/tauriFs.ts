// The REAL FsLike — wraps @tauri-apps/plugin-fs, scoped to the app-data `radio/` folder (matches the capability).
// Kept separate from radioLibrary.ts so the testable core pulls in no Tauri imports. Desktop-only.
import { mkdir, readDir, readTextFile, writeTextFile, remove, exists, rename, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir, join as pathJoin } from '@tauri-apps/api/path'
import { RadioLibrary, type FsLike } from './radioLibrary'
import { IS_DESKTOP } from '../../platform'

const ROOT = 'radio'
const opt = { baseDir: BaseDirectory.AppData } as const
const full = (p: string) => (p ? `${ROOT}/${p}` : ROOT)

function tauriFs(): FsLike {
  return {
    mkdir: async (p) => { await mkdir(full(p), { ...opt, recursive: true }) },
    readDir: async (p) => (await readDir(full(p), opt)).map((e) => ({ name: e.name, isDirectory: e.isDirectory })),
    readTextFile: (p) => readTextFile(full(p), opt),
    writeTextFile: async (p, c) => { await writeTextFile(full(p), c, opt) },
    remove: async (p, o) => { await remove(full(p), { ...opt, recursive: o?.recursive ?? false }) },
    exists: (p) => exists(full(p), opt),
    rename: async (a, b) => { await rename(full(a), full(b), { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData }) },
  }
}

/** The radio library backed by the real filesystem — null off-desktop (radio is desktop-only anyway). */
export function createRadioLibrary(): RadioLibrary | null {
  return IS_DESKTOP ? new RadioLibrary(tauriFs()) : null
}

/** Absolute OS path of the radio root (for the explorer's address bar). '' off-desktop. */
export async function radioRootAbs(): Promise<string> {
  if (!IS_DESKTOP) return ''
  return pathJoin(await appDataDir(), ROOT)
}
