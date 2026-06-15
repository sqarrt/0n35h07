/**
 * Анализатор демо-записи: выявляет интересные моменты для монтажа трейлера.
 * Запуск:  node scripts/analyzeDemo.mjs <путь к .demo.json>
 *
 * Выводит таймкоды (mm:ss.d) + индекс кадра + описание: киллы (с тиром серии/CATALYST/мультикилл),
 * идеальные блоки, и вид POV-игрока (FP/TP) в этот момент. По этому списку выбираем куски (from..to).
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) { console.error('usage: node scripts/analyzeDemo.mjs <file.demo.json>'); process.exit(1) }
const demo = JSON.parse(readFileSync(path, 'utf8'))

const TIER = { double: 'DOUBLE', triple: 'TRIPLE', singularity: 'SINGULARITY' }
const MULTI_WINDOW_MS = 3500   // киллы одного стрелка в этом окне = мультикилл

const fmt = ms => {
  const s = ms / 1000
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`
}
const nameOf = id => demo.roster.find(r => r.id === id)?.name ?? `#${id}`

// Кадр → tMs/индекс по событию: каждое событие лежит в кадре f (есть f.tMs).
const moments = []
let lastKill = {}   // shooterId → { tMs, count } для детекта мультикиллов

demo.frames.forEach((f, i) => {
  // POV-вид: тело локального скрыто → FP, иначе TP.
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
        e.victim === demo.localId ? 'я погиб' : (e.shooter === demo.localId ? 'мой килл' : ''),
      ].filter(Boolean).join(' ')
      moments.push({ tMs: f.tMs, i, kind: 'KILL', desc: `${nameOf(e.shooter)} → ${nameOf(e.victim)} ${tags} [${view}]` })
    } else if (e.t === 'block' && e.perfect) {
      moments.push({ tMs: f.tMs, i, kind: 'PERFECT BLOCK', desc: `${nameOf(e.victim)} сблокировал ${nameOf(e.shooter)} [${view}]` })
    }
  }
})

console.log(`demo: ${path}`)
console.log(`карта ${demo.mapId} · кадров ${demo.frames.length} · длит. ${fmt(demo.frames[demo.frames.length - 1].tMs)} · POV ${nameOf(demo.localId)}`)
console.log(`моментов: ${moments.length}\n`)
for (const m of moments) console.log(`${fmt(m.tMs)}  f${m.i}\t${m.kind}\t${m.desc}`)
