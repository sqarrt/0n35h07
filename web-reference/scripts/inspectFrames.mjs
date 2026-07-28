import { readFileSync } from 'node:fs'
const [, , path, a, b] = process.argv
const d = JSON.parse(readFileSync(path, 'utf8'))
for (let i = Number(a); i <= Number(b); i++) {
  const f = d.frames[i]
  if (!f) continue
  const w = f.players.map(p => `${p.id}:${(p.windupProgress ?? 0).toFixed(2)}`).join(' ')
  const ev = f.events.map(e => e.t + (e.id !== undefined ? `#${e.id}` : '')).join(',')
  console.log(`f${i}  w[${w}]${ev ? '  EV: ' + ev : ''}`)
}
