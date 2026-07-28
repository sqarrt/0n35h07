import type { Role, StemLibrary, Arrangement, VoiceSpec } from './types'
import { mulberry32, hashSeed } from './rng'

// --- COMPOSITION RULES (single place; tuned here) ---

// Song-form section types: intro/outro are the arc edges, the rest are the body.
type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro'

const INTRO_LOOPS = 4          // intro length (loops) at the start of the match
const OUTRO_MS = 16_000        // last N ms of the match are the outro
const SECTION_LOOPS: Record<SectionType, number> = {
  intro: INTRO_LOOPS, verse: 4, chorus: 4, bridge: 2, solo: 4, outro: 1,
}
// Body pattern repeats to fill the running time; stems vary across repeats.
const BODY_PATTERN: SectionType[] = ['verse', 'chorus', 'verse', 'chorus', 'bridge', 'solo', 'chorus']
const PATTERN_LOOPS = BODY_PATTERN.reduce((n, s) => n + SECTION_LOOPS[s], 0)

const SECTION_ROLES: Record<SectionType, Role[]> = {
  intro:  ['kicks', 'bass'],
  verse:  ['kicks', 'bass', 'sfx', 'lead'],
  chorus: ['kicks', 'bass', 'sfx', 'lead'],
  bridge: ['bass', 'sfx'],
  solo:   ['kicks', 'lead'],
  outro:  ['kicks', 'lead'],
}

const FOUNDATION_ROLES: Role[] = ['kicks']   // foundation (anchor): single per match, slow rotation.
                                             // Bass is NOT foundation — it's "color", changes per section (otherwise it sticks)
const FOUNDATION_POOL = 2      // foundation variants (rotates once per body-pattern pass)
const COLOR_POOL = 3           // color variants (lead/sfx) per section type
const BASS_BLOCK_LOOPS = 2     // bass never sounds longer than N loops in a row (rolling swap)
const BASS_PHASE = 1           // bass phase offset: swaps land on ODD loops. Section boundaries
                               // (where the lead changes) are always on EVEN loops (INTRO_LOOPS and all
                               // section lengths are even) → bass and lead never swap at the same time.
const ORNAMENT_GAIN = 0.2      // gain of the second lead on a one-loop ornament (below the primary lead)

const ROLE_GAIN: Record<Role, number> = { bass: 0.9, kicks: 1.0, lead: 0.32, sfx: 0.5 }
const ROLE_SALT: Record<Role, number> = { bass: 0x1111, kicks: 0x2222, lead: 0x3333, sfx: 0x4444 }

const LEAD_SECTIONS: SectionType[] = ['verse', 'chorus', 'solo']   // body sections with a primary lead

// --- VARIETY: occasional lead doubling + reverb/echo, deterministic from the seed (identical on both peers) ---
const FX_SALT = 0x5151
const DOUBLE_PROB = 0.55           // chance a lead-bearing loop thickens its primary lead with a doubled copy
const DOUBLE_MIN_SEC = 0.035       // doubled-copy offset range — a clearly audible doubling/slap (with the
const DOUBLE_MAX_SEC = 0.090       // stereo pan), well past subtle Haas thickening. Kept < 0.1s.
const ECHO_SECTIONS: SectionType[] = ['chorus', 'solo', 'outro']   // sections where the lead may get echo
const BRIDGE_REVERB = 0.34         // the sparse bridge is washed-out (atmospheric) but not harsh
const LOOP_REVERB_PROB = 0.40      // chance another loop gets a whole-mix reverb (kicks excluded — keep the beat)
const LOOP_REVERB = 0.22
const LEAD_ECHO_PROB = 0.45        // chance a chorus/solo/outro lead gets a slap of echo
const LEAD_ECHO = 0.20

interface SectionPos { type: SectionType; occurrence: number; loopInSection: number; loops: number }

/** Section type and position by place in the match: outro by remaining time, intro by the start, else body. */
function sectionAt(loopIndex: number, remainingMs: number): SectionPos {
  if (remainingMs <= OUTRO_MS) return { type: 'outro', occurrence: 0, loopInSection: 0, loops: SECTION_LOOPS.outro }
  if (loopIndex < INTRO_LOOPS) return { type: 'intro', occurrence: 0, loopInSection: loopIndex, loops: INTRO_LOOPS }
  let bodyLoop = loopIndex - INTRO_LOOPS
  const occ: Partial<Record<SectionType, number>> = {}
  for (let i = 0; ; i++) {
    const type = BODY_PATTERN[i % BODY_PATTERN.length]
    const loops = SECTION_LOOPS[type]
    const occurrence = occ[type] ?? 0
    if (bodyLoop < loops) return { type, occurrence, loopInSection: bodyLoop, loops }
    bodyLoop -= loops
    occ[type] = occurrence + 1
  }
}

/** Deterministic stem pick: base from (role + section key), variant shifts the index →
 *  different variants yield DIFFERENT stems (recognizability + guaranteed variation). */
function pickStem(seed: number, role: Role, key: string, variant: number, library: StemLibrary, gain: number): VoiceSpec | null {
  const stems = library[role]
  if (stems.length === 0) return null
  const base = Math.floor(mulberry32((seed ^ ROLE_SALT[role] ^ hashSeed(key)) >>> 0)() * stems.length)
  const idx = (base + variant) % stems.length
  return { role, stemId: stems[idx].id, gain }
}

/** Role voice for a section: kick (foundation) — single per match; lead/sfx — by section type;
 *  bass — rolling swap every 2 loops on odd phase (not tied to section, never coincides with lead);
 *  outro lead borrows the chorus hook (variant 0). */
function voiceFor(role: Role, pos: SectionPos, loopIndex: number, foundationVariant: number, seed: number, library: StemLibrary): VoiceSpec | null {
  if (role === 'lead' && pos.type === 'outro') return pickStem(seed, 'lead', 'chorus', 0, library, ROLE_GAIN.lead)
  if (FOUNDATION_ROLES.includes(role)) return pickStem(seed, role, 'foundation', foundationVariant, library, ROLE_GAIN[role])
  if (role === 'bass') {
    const block = Math.floor((loopIndex + BASS_PHASE) / BASS_BLOCK_LOOPS)   // rolling 2-loop block, odd phase
    return pickStem(seed, 'bass', 'bass', block, library, ROLE_GAIN.bass)
  }
  return pickStem(seed, role, pos.type, pos.occurrence % COLOR_POOL, library, ROLE_GAIN[role])
}

/** Ornament: a second lead on the LAST loop of a chorus/solo — a short lead-on-lead "call".
 *  Source: for a chorus — the verse lead, for a solo — the chorus lead. Guaranteed distinct from the section lead. */
function ornamentLead(pos: SectionPos, primaryLeadId: string | undefined, seed: number, library: StemLibrary): VoiceSpec | null {
  if (pos.loopInSection !== pos.loops - 1) return null
  const srcKey = pos.type === 'chorus' ? 'verse' : pos.type === 'solo' ? 'chorus' : null
  if (srcKey === null) return null
  const v = pickStem(seed, 'lead', srcKey, pos.occurrence % COLOR_POOL, library, ORNAMENT_GAIN)
  if (!v) return null
  let stemId = v.stemId
  if (stemId === primaryLeadId) {                 // ensure the two leads differ
    const leads = library.lead
    const i = leads.findIndex(s => s.id === stemId)
    stemId = leads[(i + 1) % leads.length].id
    if (stemId === primaryLeadId) return null      // only one lead in the library — skip the ornament
  }
  return { role: 'lead', stemId, gain: ORNAMENT_GAIN }
}

/** Lead rest on the FIRST loop of a lead section if the previous section already had a lead: two
 *  different leads need at least 1 loop of silence between them (a seamless lead→lead transition grates).
 *  Outro/intro don't count (intro has no lead; outro is the finale, the hook enters at once). Overlapping
 *  leads (the ornament) are fine. */
function leadRests(loopIndex: number, remainingMs: number, pos: SectionPos): boolean {
  if (pos.loopInSection !== 0 || !LEAD_SECTIONS.includes(pos.type)) return false
  return SECTION_ROLES[sectionAt(loopIndex - 1, remainingMs).type].includes('lead')
}

/** Pure deterministic composition. The single place for musical rules. */
export class MusicDirector {
  compose(seed: number, loopIndex: number, library: StemLibrary, remainingMs: number): Arrangement {
    const pos = sectionAt(loopIndex, remainingMs)
    const foundationVariant = Math.floor(loopIndex / PATTERN_LOOPS) % FOUNDATION_POOL
    const restLead = leadRests(loopIndex, remainingMs, pos)
    const voices: VoiceSpec[] = []
    for (const role of SECTION_ROLES[pos.type]) {
      if (role === 'lead' && restLead) continue   // rest between different leads
      const v = voiceFor(role, pos, loopIndex, foundationVariant, seed, library)
      if (v) voices.push(v)
    }
    const orn = ornamentLead(pos, voices.find(v => v.role === 'lead')?.stemId, seed, library)
    if (orn && !voices.some(v => v.stemId === orn.stemId)) voices.push(orn)
    applyVariety(voices, seed, loopIndex, pos)
    return voices
  }
}

/** Seeded, deterministic per-loop variety: thicken the lead, wash the mix with reverb, slap echo on a
 *  spotlight lead. Same seed+loop → same choices, so host and client stay in sync. Mutates `voices`. */
function applyVariety(voices: VoiceSpec[], seed: number, loopIndex: number, pos: SectionPos): void {
  const r = mulberry32((seed ^ FX_SALT ^ loopIndex) >>> 0)
  const lead = voices.find(v => v.role === 'lead')
  if (lead && LEAD_SECTIONS.includes(pos.type) && r() < DOUBLE_PROB) {
    lead.doubleSec = DOUBLE_MIN_SEC + r() * (DOUBLE_MAX_SEC - DOUBLE_MIN_SEC)
  }
  const reverb = pos.type === 'bridge' ? BRIDGE_REVERB : (r() < LOOP_REVERB_PROB ? LOOP_REVERB : 0)
  if (reverb > 0) for (const v of voices) if (v.role !== 'kicks') v.reverb = reverb   // keep the beat dry
  if (lead && ECHO_SECTIONS.includes(pos.type) && r() < LEAD_ECHO_PROB) lead.echo = LEAD_ECHO
}
