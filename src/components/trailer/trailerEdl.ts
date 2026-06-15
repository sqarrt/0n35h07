/**
 * Раскадровка трейлера (Edit Decision List): порядок «шотов».
 * - 'play' = один клип + список КОРОТКИХ фрагментов (≤1.5с): джамп-каты внутри одного клипа (без пересборки
 *   игроков → без чёрных кадров). Смена клипа = новый play-шот (пересборка скрыта под ковер-затемнением +
 *   текстовой перебивкой).
 * - В нарезке каждый набор скинов (= каждый клип) показан хотя бы в одном TP-фрагменте.
 * Индексы кадров — из scripts/analyzeDemo.mjs. 30fps: 1.5с ≈ 45 кадров.
 */
export type ClipId = 'os_arena' | 'os_india' | 'os_pillars'
export interface Range { from: number; to: number }

export type TrailerShot =
  | { type: 'countdown'; clip: ClipId; frame: number; durationMs: number }   // 3-2-1 на пустоте
  | { type: 'text'; text: string; durationMs: number }                       // перебивка (киберпанк-текст)
  | { type: 'play'; clip: ClipId; ranges: Range[] }                          // клип + короткие фрагменты
  | { type: 'finale' }                                                       // slow-mo встречный выстрел

export const CLIP_FILES: Record<ClipId, string> = {
  os_arena: 'os_arena.demo.json',
  os_india: 'os_india.demo.json',
  os_pillars: 'os_pillars.demo.json',
}

const CUT_MS = 900

export const TRAILER_SHOTS: TrailerShot[] = [
  { type: 'countdown', clip: 'os_arena', frame: 90, durationMs: 3200 },
  { type: 'text', text: 'READ YOUR OPPONENT', durationMs: CUT_MS },
  // os_arena (cyan/planet/rage) — БЕЗ singularity до MAKE IT YOURS
  { type: 'play', clip: 'os_arena', ranges: [
    { from: 160, to: 196 },   // идеальный блок игрока (174) — FP (обрезано до начала зарядки на f199)
    { from: 308, to: 345 },   // СОПЕРНИК уворачивается дэшем (325) — FP
    { from: 745, to: 788 },   // DOUBLE (763) — TP ✅ скин arena в 3-м лице
    { from: 250, to: 285 },   // DOUBLE (266) — FP
  ] },
  { type: 'text', text: 'ONE SHOT, ONE KILL', durationMs: CUT_MS },
  // os_india (pink/waves/singularity) — БЕЗ singularity до MAKE IT YOURS
  { type: 'play', clip: 'os_india', ranges: [
    { from: 145, to: 185 },   // CATALYST (163) — FP
    { from: 295, to: 330 },   // DOUBLE (310) — FP
    { from: 1270, to: 1300 }, // DOUBLE (1285) — TP ✅ скин india в 3-м лице
    { from: 1983, to: 2018 }, // СОПЕРНИК уворачивается дэшем (1998) — TP
  ] },
  { type: 'text', text: 'OUTPLAY THEM', durationMs: CUT_MS },
  // os_pillars (yellow/smooth/classic) — блок соперника + увороты + серии
  { type: 'play', clip: 'os_pillars', ranges: [
    { from: 95, to: 135 },    // СОПЕРНИК блокирует выстрел игрока (perfect, 111) — TP ✅
    { from: 720, to: 765 },   // блок→DOUBLE (760) — TP ✅ скин pillars в 3-м лице
    { from: 933, to: 970 },   // СОПЕРНИК уворачивается дэшем (948) — TP
    { from: 800, to: 835 },   // TRIPLE MULTI (819) — TP
  ] },
  { type: 'text', text: 'MAKE IT YOURS', durationMs: CUT_MS },
  // С ЭТОГО МЕСТА — SINGULARITY-феерия (раньше не показываем), вся ширина скинов
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
