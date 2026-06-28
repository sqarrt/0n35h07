// Track arrangement as a Switch-Angel-style ENERGY GRAPH, not random layer toggling:
//   intro (low, atmospheric) → build (clarity rises) → MEAT (the FAT peak: kick+bass+
//   lead+perc all on, every loop) → break (rest) → build → MEAT-2 (a SECOND movement:
//   new lead/bass, same manner) → outro.
// The peak is the FATTEST part — everything sounds at once, it must never feel thinner
// than the build. The bass⇄lead "call & response" is NOT a split into separate sections
// (that hollowed the peaks and broke continuity) and no longer even two peak variants —
// it lives WITHIN one peak loop as per-bar dynamics: bass forward for 3 bars, the lead
// answering on the 4th. So nothing fully drops between adjacent loops → continuity.
import type { Rng } from '../seededRandom'
import type { LayerFlags } from './MusicalState'

export type SectionRole = 'intro' | 'introB' | 'build' | 'peak' | 'break' | 'outro' | 'float'

export interface SectionShape {
  role: SectionRole
  energy: number // 0..1 — drives brightness/level/clarity
  bars: number
  layers: LayerFlags
}

function L(kicks: boolean, bass: boolean, lead: boolean, bg: boolean, perc: boolean): LayerFlags {
  return { kicks, bass, lead, bg, perc }
}

const SHAPES: Record<SectionRole, Omit<SectionShape, 'role'>> = {
  intro: { energy: 0.22, bars: 8, layers: L(true, true, false, true, false) },  // muffled kick+bass + memory pad
  introB: { energy: 0.3, bars: 8, layers: L(false, true, true, true, false) },  // a drumless bass+lead opening (kick drops in at the build)
  build: { energy: 0.55, bars: 8, layers: L(true, true, true, true, false) },   // clarity rises, lead enters
  peak: { energy: 0.94, bars: 4, layers: L(true, true, true, false, true) },    // FULL peak — bass forward, lead answers on bar 4 (call & response WITHIN the loop)
  break: { energy: 0.4, bars: 8, layers: L(true, false, false, true, true) }, // rest from bass/lead, but kick + hats + snare + fills + a build-back keep it alive
  outro: { energy: 0.3, bars: 8, layers: L(true, true, false, true, false) },
  float: { energy: 0.42, bars: 8, layers: L(false, false, true, true, false) }, // NO kick/bass/perc — pure lead + bg (a striking start or a drumless interlude)
}

// A run of full peak loops (the call-and-response now lives inside each loop).
function meat(len: number): SectionRole[] {
  return Array.from({ length: len }, () => 'peak' as SectionRole)
}

/**
 * Build the whole-track role list. NOT one fixed shape — picks a FORM (anthem /
 * hypnotic / peak-time / stripped / slow-burn) and randomises its internals, so
 * tracks differ in macro-structure, not just timbre. Deep moods get calmer forms.
 */
export function buildArc(rng: Rng, gentle = false): SectionRole[] {
  const forms = gentle ? ['hypnotic', 'stripped', 'hypnotic'] : ['anthem', 'peaktime', 'slowburn', 'hypnotic', 'stripped']
  const form = forms[rng.int(forms.length)]
  // ~35% of tracks OPEN on a pure lead (kickless float) INSTEAD of the muffled intro — the
  // lead then carries straight into the first build/peak (which also has the lead on), so it
  // never cuts out. float must always be followed by a lead-bearing section, never intro/
  // break/outro, or the sustained lead would just stop dead.
  // Vary the OPENING (Switch Angel: intros aren't always one combo): float = lead+bg, introB = bass+lead,
  // intro = kick+bass+bg. A lead-bearing opening always runs into a build/meat, so the lead never stops dead.
  const r0 = rng.next()
  const arc: SectionRole[] = r0 < 0.22 ? ['float'] : r0 < 0.40 ? ['introB'] : ['intro']
  const builds = (k: number) => { for (let i = 0; i < k; i++) arc.push('build') }

  if (form === 'anthem') {
    builds(1 + rng.int(2)); arc.push(...meat(2 + rng.int(2))); arc.push('break')
    builds(1 + rng.int(2)); arc.push(...meat(2 + rng.int(2)))
  } else if (form === 'hypnotic') {
    builds(1); arc.push(...meat(3 + rng.int(2)))
    if (rng.next() < 0.6) {
      arc.push('break')
      if (rng.next() < 0.5) arc.push('float') // break -> float (lead re-enters) -> meat: lead never cuts
      arc.push(...meat(2 + rng.int(2)))
    }
  } else if (form === 'peaktime') {
    builds(1)
    const blocks = 2 + rng.int(2)
    for (let b = 0; b < blocks; b++) {
      arc.push(...meat(2 + rng.int(2)))
      if (b < blocks - 1) arc.push('break')
    }
  } else if (form === 'stripped') {
    if (rng.next() < 0.5) arc.push('float') // open the body on a kickless lead+bg passage
    arc.push(...meat(3 + rng.int(2)))
  } else { // slowburn
    builds(2 + rng.int(2)); arc.push(...meat(2 + rng.int(2))); arc.push('break')
    builds(2); arc.push(...meat(2 + rng.int(2)))
  }

  arc.push('outro')
  return arc
}

export function shapeFor(role: SectionRole): SectionShape {
  return { role, ...SHAPES[role] }
}
