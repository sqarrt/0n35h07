// Bank schemas + a validator. Pure data: no I/O here — callers pass already-parsed
// JSON. A malformed bank throws with a precise message rather than breaking music.

export type Range = readonly [number, number]
export interface MoodFx { lpfRange: Range; roomRange: Range; saturation: number; sidechainDepth: number }
export interface MoodConfig {
  bpmRange: Range; swing: number; density: number
  preferredScales: string[]; preferredKeys: string[]
  fx: MoodFx; drumKits: string[]; instruments: string[]
  layerProbabilities: { lead: number; atmosphere: number; perc: number }
  arrangementWeights: { A: number; A_prime: number; break: number; B: number }
  graphMode: number
}
export type MoodsBank = Record<string, MoodConfig>
export type WeightedEdge = readonly [string, number]
export interface ProgressionsBank { graph: Record<string, WeightedEdge[]>; presets: string[][] }
export interface DrumKit { kick: string[]; snare: string[]; hh: string[]; fills: string[] }
export type DrumsBank = Record<string, DrumKit>
export interface InstrumentConfig {
  strudelSound: string; gainRange?: Range; octaveRange?: Range; lpfDefault?: number; resonance?: number
}
export type InstrumentsBank = Record<string, InstrumentConfig>
export type ScalesBank = Record<string, number[]>
export interface RadioBanks {
  moods: MoodsBank; progressions: ProgressionsBank; drums: DrumsBank
  instruments: InstrumentsBank; scales: ScalesBank
}

class BankError extends Error {}
function fail(msg: string): never { throw new BankError(`Invalid radio bank: ${msg}`) }

function num(v: unknown, where: string): number {
  if (typeof v !== 'number' || Number.isNaN(v)) fail(`${where} must be a number`)
  return v as number
}
function range(v: unknown, where: string): Range {
  if (!Array.isArray(v) || v.length !== 2) fail(`${where} must be a [min, max] pair`)
  return [num(v[0], `${where}[0]`), num(v[1], `${where}[1]`)] as Range
}
function strArr(v: unknown, where: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) fail(`${where} must be a string[]`)
  return v as string[]
}
function obj(v: unknown, where: string): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) fail(`${where} must be an object`)
  return v as Record<string, unknown>
}

function validateScales(raw: unknown): ScalesBank {
  const o = obj(raw, 'scales')
  const out: ScalesBank = {}
  for (const [name, v] of Object.entries(o)) {
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'number')) fail(`scale ${name} must be number[]`)
    out[name] = v as number[]
  }
  if (Object.keys(out).length === 0) fail('scales is empty')
  return out
}

function validateProgressions(raw: unknown): ProgressionsBank {
  const o = obj(raw, 'progressions')
  const graphRaw = obj(o.graph, 'progressions.graph')
  const graph: Record<string, WeightedEdge[]> = {}
  for (const [node, edges] of Object.entries(graphRaw)) {
    if (!Array.isArray(edges)) fail(`progressions.graph.${node} must be an array`)
    graph[node] = edges.map((e, i) => {
      if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string')
        fail(`progressions.graph.${node}[${i}] must be [chord, weight]`)
      return [e[0], num(e[1], `progressions.graph.${node}[${i}][1]`)] as WeightedEdge
    })
  }
  const nodes = new Set(Object.keys(graph))
  for (const [node, edges] of Object.entries(graph))
    for (const [target] of edges)
      if (!nodes.has(target)) fail(`progressions.graph.${node} edge points at unknown chord ${target}`)
  const presetsRaw = o.presets
  if (!Array.isArray(presetsRaw)) fail('progressions.presets must be an array')
  const presets = presetsRaw.map((p, i) => strArr(p, `progressions.presets[${i}]`))
  return { graph, presets }
}

function validateDrums(raw: unknown): DrumsBank {
  const o = obj(raw, 'drums')
  const out: DrumsBank = {}
  for (const [kit, v] of Object.entries(o)) {
    const k = obj(v, `drums.${kit}`)
    out[kit] = {
      kick: strArr(k.kick, `drums.${kit}.kick`),
      snare: strArr(k.snare, `drums.${kit}.snare`),
      hh: strArr(k.hh, `drums.${kit}.hh`),
      fills: strArr(k.fills, `drums.${kit}.fills`),
    }
  }
  if (Object.keys(out).length === 0) fail('drums is empty')
  return out
}

function validateInstruments(raw: unknown): InstrumentsBank {
  const o = obj(raw, 'instruments')
  const out: InstrumentsBank = {}
  for (const [name, v] of Object.entries(o)) {
    const i = obj(v, `instruments.${name}`)
    if (typeof i.strudelSound !== 'string') fail(`instruments.${name}.strudelSound must be a string`)
    const inst: InstrumentConfig = { strudelSound: i.strudelSound }
    if (i.gainRange !== undefined) inst.gainRange = range(i.gainRange, `instruments.${name}.gainRange`)
    if (i.octaveRange !== undefined) inst.octaveRange = range(i.octaveRange, `instruments.${name}.octaveRange`)
    if (i.lpfDefault !== undefined) inst.lpfDefault = num(i.lpfDefault, `instruments.${name}.lpfDefault`)
    if (i.resonance !== undefined) inst.resonance = num(i.resonance, `instruments.${name}.resonance`)
    out[name] = inst
  }
  if (Object.keys(out).length === 0) fail('instruments is empty')
  return out
}

function validateMoods(raw: unknown, scales: ScalesBank, drums: DrumsBank, instruments: InstrumentsBank): MoodsBank {
  const o = obj(raw, 'moods')
  const out: MoodsBank = {}
  for (const [name, v] of Object.entries(o)) {
    const m = obj(v, `moods.${name}`)
    const fx = obj(m.fx, `moods.${name}.fx`)
    const lp = obj(m.layerProbabilities, `moods.${name}.layerProbabilities`)
    const aw = obj(m.arrangementWeights, `moods.${name}.arrangementWeights`)
    const mood: MoodConfig = {
      bpmRange: range(m.bpmRange, `moods.${name}.bpmRange`),
      swing: num(m.swing, `moods.${name}.swing`),
      density: num(m.density, `moods.${name}.density`),
      preferredScales: strArr(m.preferredScales, `moods.${name}.preferredScales`),
      preferredKeys: strArr(m.preferredKeys, `moods.${name}.preferredKeys`),
      fx: {
        lpfRange: range(fx.lpfRange, `moods.${name}.fx.lpfRange`),
        roomRange: range(fx.roomRange, `moods.${name}.fx.roomRange`),
        saturation: num(fx.saturation, `moods.${name}.fx.saturation`),
        sidechainDepth: num(fx.sidechainDepth, `moods.${name}.fx.sidechainDepth`),
      },
      drumKits: strArr(m.drumKits, `moods.${name}.drumKits`),
      instruments: strArr(m.instruments, `moods.${name}.instruments`),
      layerProbabilities: {
        lead: num(lp.lead, `moods.${name}.layerProbabilities.lead`),
        atmosphere: num(lp.atmosphere, `moods.${name}.layerProbabilities.atmosphere`),
        perc: num(lp.perc, `moods.${name}.layerProbabilities.perc`),
      },
      arrangementWeights: {
        A: num(aw.A, `moods.${name}.arrangementWeights.A`),
        A_prime: num(aw.A_prime, `moods.${name}.arrangementWeights.A_prime`),
        break: num(aw.break, `moods.${name}.arrangementWeights.break`),
        B: num(aw.B, `moods.${name}.arrangementWeights.B`),
      },
      graphMode: num(m.graphMode, `moods.${name}.graphMode`),
    }
    for (const s of mood.preferredScales)
      if (!scales[s]) fail(`moods.${name}.preferredScales references unknown scale ${s}`)
    for (const k of mood.drumKits)
      if (!drums[k]) fail(`moods.${name}.drumKits references unknown kit ${k}`)
    for (const inst of mood.instruments)
      if (!instruments[inst]) fail(`moods.${name}.instruments references unknown instrument ${inst}`)
    out[name] = mood
  }
  // The ≥4-moods expectation is a property of the *shipped* banks (asserted in
  // banks.test.ts); the validator only enforces structural correctness here.
  if (Object.keys(out).length === 0) fail('moods is empty')
  return out
}

export function validateBanks(raw: {
  moods: unknown; progressions: unknown; drums: unknown; instruments: unknown; scales: unknown
}): RadioBanks {
  const scales = validateScales(raw.scales)
  const progressions = validateProgressions(raw.progressions)
  const drums = validateDrums(raw.drums)
  const instruments = validateInstruments(raw.instruments)
  const moods = validateMoods(raw.moods, scales, drums, instruments)
  return { moods, progressions, drums, instruments, scales }
}
