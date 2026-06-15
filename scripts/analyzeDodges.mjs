/** Дев-анализ: моменты, где СОПЕРНИК уворачивается от выстрела игрока (блок/дэш/прыжок). */
import { readFileSync } from 'node:fs'

const path = process.argv[2]
const d = JSON.parse(readFileSync(path, 'utf8'))
const L = d.localId
const OPP = d.roster.find(r => r.id !== L).id
const frames = d.frames
const fmt = ms => {
  const s = ms / 1000
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + (s % 60).toFixed(1).padStart(4, '0')
}

const out = []
for (let i = 0; i < frames.length; i++) {
  for (const e of frames[i].events) {
    if (e.t === 'block' && e.shooter === L) out.push([frames[i].tMs, i, 'OPP BLOCK' + (e.perfect ? ' (perfect)' : '')])
    if (e.t === 'fired' && e.id === L) {
      let killed = false, dash = false, jump = false
      for (let j = i; j < Math.min(frames.length, i + 18); j++) {
        for (const e2 of frames[j].events) {
          if (e2.t === 'kill' && e2.shooter === L) killed = true
          if (e2.t === 'move' && e2.id === OPP && e2.kind === 'jump') jump = true
        }
        const op = frames[j].players.find(p => p.id === OPP)
        if (op && op.dashing) dash = true
      }
      if (!killed && (dash || jump)) out.push([frames[i].tMs, i, 'OPP DODGE' + (dash ? ' dash' : '') + (jump ? ' jump' : '')])
    }
  }
}
console.log(`=== ${path} (увороты соперника) ===`)
for (const [ms, i, t] of out) console.log(`${fmt(ms)}  f${i}\t${t}`)
