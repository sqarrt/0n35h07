/**
 * Ensures the platform's native rolldown binary is present before running tests.
 *
 * Why: node_modules lives on /mnt/c (the Windows partition) and is SHARED between Windows and WSL.
 * npm installs the native rolldown binary only for the OS that ran `npm install`. So after
 * installing from Windows, `@rolldown/binding-linux-x64-gnu` is missing under WSL (and vice
 * versa), and vitest/vite crash on startup with "Cannot find native binding".
 *
 * What it does: tries to load rolldown IN A SEPARATE process (important: a repeat import in the
 * current process is served from the ESM cache as "already failed" and won't see the freshly
 * installed binary). If the probe fails, it extracts the missing package name straight from the
 * rolldown error and installs EXACTLY that one via `npm install --no-save` (without touching
 * package.json/package-lock or the other OS's binary), then probes again. If the binary is present
 * (the typical case on Windows) — a fast no-op.
 *
 * Runs automatically as a pre-hook of the test scripts (see package.json).
 */
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

const MAX_ATTEMPTS = 3                        // in case several binaries are missing
const BINDING_RE = /@rolldown\/binding-[\w-]+/   // name of the missing native rolldown package
// Load rolldown in a child process: console.error(e) prints the [cause] chain too,
// where rolldown names the missing @rolldown/binding-* module.
const PROBE = "import('rolldown').then(() => process.exit(0)).catch(e => { console.error(e); process.exit(7) })"

/** Version of the installed rolldown — we install the binary of exactly the same version. */
function rolldownVersion() {
  const pkg = JSON.parse(readFileSync(require.resolve('rolldown/package.json'), 'utf8'))
  return pkg.version
}

/** Fresh probe loading rolldown in a separate process. status===0 → binary is present. */
function probe() {
  return spawnSync(process.execPath, ['-e', PROBE], { encoding: 'utf8' })
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const res = probe()
  if (res.status === 0) process.exit(0)       // binary loaded — everything is in place

  const missing = res.stderr.match(BINDING_RE)?.[0]
  if (!missing) {                              // not our case — don't mask an unrelated error
    process.stderr.write(res.stderr)
    throw new Error('[ensure-native] could not identify the missing rolldown binary in the error above')
  }

  const pkg = `${missing}@${rolldownVersion()}`
  console.log(`[ensure-native] installing ${pkg} (platform rolldown binary is missing)`)
  execFileSync('npm', ['install', '--no-save', pkg], { stdio: 'inherit' })
}

if (probe().status === 0) process.exit(0)
console.error('[ensure-native] failed to provide the native rolldown binary within the allotted attempts')
process.exit(1)
