/* Build the Steam desktop depot locally and assemble it into `steam-build/` for a manual
 * SteamPipe upload. Run:  npm run build:steam
 *
 * IMPORTANT: the Steam build is a WINDOWS .exe — run this from a Windows shell (PowerShell/cmd)
 * to get the Windows depot. Under WSL/Linux cargo produces a Linux binary instead (a Linux depot).
 *
 * Steps: frontend (tauri mode) -> cargo build --release (the exe, with dist/ embedded + build.rs
 * copies the Steam runtime lib next to it) -> copy the exe + runtime lib into steam-build/.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = resolve(ROOT, 'src-tauri', 'target', 'release')
const OUT = resolve(ROOT, 'steam-build')

const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit' })

// Per-OS artifacts: cargo's binary name + the Steam runtime lib (build.rs copies it next to the exe),
// and the depot-facing exe name (must match the Steamworks launch option).
const PLATFORM = {
  win32:  { bin: 'app.exe', lib: 'steam_api64.dll',   outBin: '0N35H07.exe', label: 'Windows' },
  linux:  { bin: 'app',     lib: 'libsteam_api.so',   outBin: '0N35H07',     label: 'Linux' },
  darwin: { bin: 'app',     lib: 'libsteam_api.dylib', outBin: '0N35H07',    label: 'macOS' },
}[process.platform]

if (!PLATFORM) { console.error(`Unsupported platform: ${process.platform}`); process.exit(1) }
if (process.platform !== 'win32') {
  console.warn(`\n⚠  Building a ${PLATFORM.label} depot (not Windows). For the Steam Windows build, run this from a Windows shell.\n`)
}

console.log('▶ Building frontend (tauri mode)…')
run('npm run build:desktop')

// --features custom-protocol is MANDATORY: it is what `tauri build` enables under the hood. Without it
// the `tauri` crate compiles in dev mode and the exe loads devUrl (http://localhost:5173) instead of the
// embedded frontend — so the packaged game can't start without the Vite dev server. See src-tauri/Cargo.toml.
console.log('▶ Building the desktop binary (release, custom-protocol)…')
run('cargo build --release --features custom-protocol', resolve(ROOT, 'src-tauri'))

const bin = resolve(RELEASE, PLATFORM.bin)
const lib = resolve(RELEASE, PLATFORM.lib)
for (const [what, p] of [['binary', bin], ['Steam runtime lib', lib]]) {
  if (!existsSync(p)) { console.error(`✗ Missing ${what}: ${p}`); process.exit(1) }
}

// Windows holds brief locks on freshly-built/just-run files (the previous OneShot.exe, antivirus scans, an open
// Explorer/terminal in steam-build) → rmSync can throw EPERM/EBUSY. Retry a few times; on a persistent lock,
// tell the user what to close instead of dying with a raw stack trace.
try {
  rmSync(OUT, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
} catch (e) {
  console.error(`✗ Could not clear ${OUT}: ${e.code || e.message}`)
  console.error('  Something is holding it open. Close any running OneShot.exe (a launched build), any Explorer/terminal window inside steam-build, then re-run.')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })
copyFileSync(bin, resolve(OUT, PLATFORM.outBin))
copyFileSync(lib, resolve(OUT, PLATFORM.lib))

const mb = (p) => (statSync(p).size / 1048576).toFixed(2)
console.log(`\n✔ Depot assembled in steam-build/ (${PLATFORM.label}):`)
console.log(`   ${PLATFORM.outBin}   ${mb(resolve(OUT, PLATFORM.outBin))} MB`)
console.log(`   ${PLATFORM.lib}      ${mb(resolve(OUT, PLATFORM.lib))} MB`)
console.log(`\nUpload the CONTENTS of steam-build/ as the depot via SteamPipe, then set the build live.`)
console.log(`Steamworks launch-option executable must be: ${PLATFORM.outBin}`)
