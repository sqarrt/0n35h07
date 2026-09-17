import { rhythmOnsets, type LeadRhythm } from './leadRhythm'
import type { MelEl } from './leadMelody'

function renderEl(el: MelEl, deg: (d: number) => number): string {
  return Array.isArray(el) ? `[${el.map(deg).join(',')}]` : String(deg(el))
}
/** Lay the melody els onto the rhythm onsets → a 4-bar `<[…] […] […] […]>` note body (absolute via `deg`).
 *  `els.length` MUST equal `onsetCount(rhythm)` (a `pair` consumes two els as a 16th sub-group). */
export function combineLead(rhythm: Pick<LeadRhythm, 'bars'>, els: MelEl[], deg: (d: number) => number): string {
  let k = 0
  const next = () => els[k++]
  const bars = rhythmOnsets(rhythm).map((slots) =>
    `[${slots.map((s) => {
      if (s === 'rest') return '~'
      if (s === 'pair') return `[${renderEl(next(), deg)} ${renderEl(next(), deg)}]`
      return renderEl(next(), deg)
    }).join(' ')}]`)
  return `<${bars.join(' ')}>`
}
