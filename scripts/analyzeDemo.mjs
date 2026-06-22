/**
 * Demo recording analyzer: finds interesting moments for trailer editing.
 * Run:  node scripts/analyzeDemo.mjs <path to .demo.json>
 *
 * Prints timecodes (mm:ss.d) + frame index + description: kills (with streak tier/CATALYST/multikill),
 * perfect blocks, and the POV player's view (FP/TP) at that moment. We pick clips (from..to) from this list.
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) { console.error('usage: node scripts/analyzeDemo.mjs <file.demo.json>'); process.exit(1) }
const demo = JSON.parse(readFileSync(path, 'utf8'))

const TIER = { double: 'DOUBLE', triple: 'TRIPLE', singularity: 'SINGULARITY' }
const MULTI_WINDOW_MS = 3500   // one shooter's kills within this window = multikill

const fmt = ms => {
  const s = ms / 1000
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`
}
const nameOf = id => demo.roster.find(r => r.id === id)?.name ?? `#${id}`

// Frame → tMs/index per event: every event lives in frame f (has f.tMs).
const moments = []
let lastKill = {}   // shooterId → { tMs, count } for multikill detection

demo.frames.forEach((f, i) => {
  // POV view: local body hidden → FP, otherwise TP.
  const pov = f.players.find(p => p.id === demo.localId)
  const view = pov ? (pov.bodyVisible ? 'TP' : 'FP') : '?'
  for (const e of f.events) {
    if (e.t === 'kill') {
      const tier = TIER[/** streak tier */ (e.streak >= 5 ? 'singularity' : e.streak >= 3 ? 'triple' : e.streak >= 2 ? 'double' : '')] || ''
      const prev = lastKill[e.shooter]
      const multi = prev && (f.tMs - prev.tMs) <= MULTI_WINDOW_MS
      lastKill[e.shooter] = { tMs: f.tMs, count: multi ? prev.count + 1 : 1 }
      const tags = [
        e.firstBlood ? 'CATALYST(1st blood)' : '',
        tier ? `streak:${tier}` : '',
        multi ? `MULTI x${lastKill[e.shooter].count}` : '',
        e.victim === demo.localId ? 'I died' : (e.shooter === demo.localId ? 'my kill' : ''),
      ].filter(Boolean).join(' ')
      moments.push({ tMs: f.tMs, i, kind: 'KILL', desc: `${nameOf(e.shooter)} → ${nameOf(e.victim)} ${tags} [${view}]` })
    } else if (e.t === 'block' && e.perfect) {
      moments.push({ tMs: f.tMs, i, kind: 'PERFECT BLOCK', desc: `${nameOf(e.victim)} blocked ${nameOf(e.shooter)} [${view}]` })
    }
  }
})

console.log(`demo: ${path}`)
console.log(`map ${demo.mapId} · frames ${demo.frames.length} · duration ${fmt(demo.frames[demo.frames.length - 1].tMs)} · POV ${nameOf(demo.localId)}`)
console.log(`moments: ${moments.length}\n`)
for (const m of moments) console.log(`${fmt(m.tMs)}  f${m.i}\t${m.kind}\t${m.desc}`)
