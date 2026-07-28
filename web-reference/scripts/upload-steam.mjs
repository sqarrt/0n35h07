/* Upload the assembled steam-build/ depot to SteamPipe via steamcmd. Parameterized by app id, so the
 * SAME build can go to the main app and to the Playtest app.
 *
 *   npm run build:steam                                   # produce steam-build/ first (on Windows)
 *   npm run upload:steam -- --app 4881310 --user <steamLogin> [--branch default]
 *   npm run upload:steam -- --app 4888710 --user <steamLogin>   # Playtest app
 *
 * Flags:
 *   --app <id>       (required) Steam AppID to publish under.
 *   --depot <id>     depot id (default: app+1 — the usual first-depot convention; confirm in Steamworks).
 *   --branch <name>  set the build live on this branch (default: none → upload only, set live in the portal).
 *   --user <login>   Steam build-account login (or env STEAM_USER). First run prompts for password + Guard.
 *   --content <dir>  depot content folder (default: steam-build).
 *   --desc <text>    build description (default: "local YYYY-MM-DD").
 *   --steamcmd <bin> steamcmd executable (default: env STEAMCMD or "steamcmd").
 *
 * steamcmd must be installed (Steamworks SDK tools/ContentBuilder, or a standalone steamcmd on PATH).
 */
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const app = arg('app')
if (!app || !/^\d+$/.test(app)) { console.error('✗ --app <numeric AppID> is required'); process.exit(1) }
const depot = arg('depot', String(Number(app) + 1))
const branch = arg('branch', '')                       // empty → no setlive
const user = arg('user', process.env.STEAM_USER)
if (!user) { console.error('✗ --user <steamLogin> (or env STEAM_USER) is required'); process.exit(1) }
const content = resolve(ROOT, arg('content', 'steam-build'))
const desc = arg('desc', `local ${new Date().toISOString().slice(0, 10)}`)
const steamcmd = arg('steamcmd', process.env.STEAMCMD || 'steamcmd')

if (!existsSync(content) || readdirSync(content).length === 0) {
  console.error(`✗ Content folder is empty/missing: ${content}\n  Run "npm run build:steam" first (on Windows for the Windows depot).`)
  process.exit(1)
}

// Generate the SteamPipe VDFs in a temp dir (kept OUT of the content root so they aren't packed into the depot).
const work = mkdtempSync(join(tmpdir(), `oneshot-steam-${app}-`))
const buildOutput = join(work, 'output')
mkdirSync(buildOutput, { recursive: true })

const depotVdf = join(work, `depot_build_${depot}.vdf`)
writeFileSync(depotVdf, `"DepotBuildConfig"
{
  "DepotID" "${depot}"
  "FileMapping" { "LocalPath" "*" "DepotPath" "." "recursive" "1" }
  "FileExclusion" "*.pdb"
}
`)

const appVdf = join(work, `app_build_${app}.vdf`)
writeFileSync(appVdf, `"appbuild"
{
  "appid" "${app}"
  "desc" "${desc}"
  "buildoutput" "${buildOutput.replace(/\\/g, '/')}"
  "contentroot" "${content.replace(/\\/g, '/')}"
  "setlive" "${branch}"
  "depots" { "${depot}" "depot_build_${depot}.vdf" }
}
`)

console.log(`▶ Uploading ${content}`)
console.log(`   app ${app}, depot ${depot}, branch ${branch || '(none — set live in the portal)'}, desc "${desc}"`)
console.log(`   steamcmd: ${steamcmd}  (first run will prompt for password + Steam Guard)\n`)

try {
  execSync(`${steamcmd} +login ${user} +run_app_build "${appVdf}" +quit`, { stdio: 'inherit' })
  console.log(`\n✔ Upload finished. If no --branch was set, set the build live in Steamworks → SteamPipe → Builds.`)
} catch {
  console.error(`\n✗ steamcmd failed. Common causes: stale Steam Guard (re-login: "${steamcmd} +login ${user}"),`)
  console.error(`  wrong depot id (check Steamworks → app ${app} → Depots), or no setlive permission for the branch.`)
  process.exit(1)
}
