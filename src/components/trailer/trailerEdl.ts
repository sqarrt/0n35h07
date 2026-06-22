/**
 * Trailer storyboard (Edit Decision List): the order of "shots".
 * - 'play' = one clip + a list of SHORT fragments (≤1.5s): jump cuts within a single clip (no player
 *   rebuild → no black frames). Switching clips = a new play shot (the rebuild is hidden under the cover
 *   dimmer + a text cut).
 * - In the montage, each skin set (= each clip) is shown in at least one TP fragment.
 * Frame indices come from scripts/analyzeDemo.mjs. At 30fps: 1.5s ≈ 45 frames.
 */
export type ClipId = 'os_arena' | 'os_india' | 'os_pillars'
export interface Range { from: number; to: number }

export type TrailerShot =
  | { type: 'countdown'; clip: ClipId; frame: number; durationMs: number }   // 3-2-1 over emptiness
  | { type: 'text'; text: string; durationMs: number }                       // cut (cyberpunk text)
  | { type: 'play'; clip: ClipId; ranges: Range[] }                          // clip + short fragments
  | { type: 'finale' }                                                       // slow-mo counter-shot

export const CLIP_FILES: Record<ClipId, string> = {
  os_arena: 'os_arena.demo.json',
  os_india: 'os_india.demo.json',
  os_pillars: 'os_pillars.demo.json',
}

const CUT_MS = 900

export const TRAILER_SHOTS: TrailerShot[] = [
  { type: 'countdown', clip: 'os_arena', frame: 90, durationMs: 3200 },
  { type: 'text', text: 'READ YOUR OPPONENT', durationMs: CUT_MS },
  // os_arena (cyan/planet/rage) — NO singularity until MAKE IT YOURS
  { type: 'play', clip: 'os_arena', ranges: [
    { from: 160, to: 196 },   // player's perfect block (174) — FP (trimmed to before windup starts at f199)
    { from: 308, to: 345 },   // OPPONENT dodges with a dash (325) — FP
    { from: 745, to: 788 },   // DOUBLE (763) — TP ✅ arena skin in third person
    { from: 250, to: 285 },   // DOUBLE (266) — FP
  ] },
  { type: 'text', text: 'ONE SHOT, ONE KILL', durationMs: CUT_MS },
  // os_india (pink/waves/singularity) — NO singularity until MAKE IT YOURS
  { type: 'play', clip: 'os_india', ranges: [
    { from: 145, to: 185 },   // CATALYST (163) — FP
    { from: 295, to: 330 },   // DOUBLE (310) — FP
    { from: 1270, to: 1300 }, // DOUBLE (1285) — TP ✅ india skin in third person
    { from: 1983, to: 2018 }, // OPPONENT dodges with a dash (1998) — TP
  ] },
  { type: 'text', text: 'OUTPLAY THEM', durationMs: CUT_MS },
  // os_pillars (yellow/smooth/classic) — opponent block + dodges + streaks
  { type: 'play', clip: 'os_pillars', ranges: [
    { from: 95, to: 135 },    // OPPONENT blocks the player's shot (perfect, 111) — TP ✅
    { from: 720, to: 765 },   // block→DOUBLE (760) — TP ✅ pillars skin in third person
    { from: 933, to: 970 },   // OPPONENT dodges with a dash (948) — TP
    { from: 800, to: 835 },   // TRIPLE MULTI (819) — TP
  ] },
  { type: 'text', text: 'MAKE IT YOURS', durationMs: CUT_MS },
  // FROM HERE ON — the SINGULARITY spectacle (not shown earlier), the full breadth of skins
  { type: 'play', clip: 'os_arena', ranges: [
    { from: 1015, to: 1048 }, // SINGULARITY (1032) — TP
    { from: 1165, to: 1200 }, // SINGULARITY (1183) — FP
  ] },
  { type: 'play', clip: 'os_india', ranges: [
    { from: 488, to: 522 },   // SINGULARITY x4 (515) — FP
    { from: 1028, to: 1062 }, // SINGULARITY (1050) — TP
  ] },
  { type: 'play', clip: 'os_pillars', ranges: [
    { from: 1873, to: 1905 }, // SINGULARITY (1888) — TP
  ] },
  { type: 'finale' },
]
