import type { Role, StemLibrary, Arrangement, VoiceSpec } from './types'
import { mulberry32, hashSeed } from './rng'

// --- ПРАВИЛА КОМПОЗИЦИИ (единственное место; тюнятся здесь) ---

// Типы секций песенной формы: intro/outro — края арки, остальные — тело.
type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro'

const INTRO_LOOPS = 4          // длина интро (лупов) в начале матча
const OUTRO_MS = 16_000        // последние N мс матча — аутро
const SECTION_LOOPS: Record<SectionType, number> = {
  intro: INTRO_LOOPS, verse: 4, chorus: 4, bridge: 2, solo: 4, outro: 1,
}
// Паттерн тела — повторяется, добивая хронометраж; стемы варьируются на повторах.
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

const FOUNDATION_ROLES: Role[] = ['kicks']   // фундамент (опора): единый по матчу, медленная ротация.
                                             // Бас НЕ фундамент — он «цвет», меняется по секциям (иначе залипает)
const FOUNDATION_POOL = 2      // вариантов фундамента (ротация раз в проход паттерна тела)
const COLOR_POOL = 3           // вариантов цвета (lead/sfx) на тип секции
const ORNAMENT_GAIN = 0.5      // гейн второго лида на одно-луповом орнаменте

const ROLE_GAIN: Record<Role, number> = { bass: 0.9, kicks: 1.0, lead: 0.7, sfx: 0.5 }
const ROLE_SALT: Record<Role, number> = { bass: 0x1111, kicks: 0x2222, lead: 0x3333, sfx: 0x4444 }

interface SectionPos { type: SectionType; occurrence: number; loopInSection: number; loops: number }

/** Тип и позиция секции по месту в матче: аутро — по остатку времени, интро — по началу, иначе тело. */
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

/** Детерминированный выбор стема: база от (роль+ключ-секции), вариант сдвигает индекс →
 *  разные варианты дают РАЗНЫЕ стемы (узнаваемость + гарантированная вариация). */
function pickStem(seed: number, role: Role, key: string, variant: number, library: StemLibrary, gain: number): VoiceSpec | null {
  const stems = library[role]
  if (stems.length === 0) return null
  const base = Math.floor(mulberry32((seed ^ ROLE_SALT[role] ^ hashSeed(key)) >>> 0)() * stems.length)
  const idx = (base + variant) % stems.length
  return { role, stemId: stems[idx].id, gain }
}

/** Голос роли для секции: фундамент (bass/kicks) — единый по матчу; цвет (lead/sfx) — по типу секции;
 *  лид аутро заимствует хук припева (вариант 0). */
function voiceFor(role: Role, pos: SectionPos, foundationVariant: number, seed: number, library: StemLibrary): VoiceSpec | null {
  if (role === 'lead' && pos.type === 'outro') return pickStem(seed, 'lead', 'chorus', 0, library, ROLE_GAIN.lead)
  if (FOUNDATION_ROLES.includes(role)) return pickStem(seed, role, 'foundation', foundationVariant, library, ROLE_GAIN[role])
  return pickStem(seed, role, pos.type, pos.occurrence % COLOR_POOL, library, ROLE_GAIN[role])
}

/** Орнамент: второй лид на ПОСЛЕДНЕМ лупе припева/соло — короткая «перекличка» лид-на-лид.
 *  Источник: для припева — лид куплета, для соло — лид припева. Гарантированно отличен от лида секции. */
function ornamentLead(pos: SectionPos, primaryLeadId: string | undefined, seed: number, library: StemLibrary): VoiceSpec | null {
  if (pos.loopInSection !== pos.loops - 1) return null
  const srcKey = pos.type === 'chorus' ? 'verse' : pos.type === 'solo' ? 'chorus' : null
  if (srcKey === null) return null
  const v = pickStem(seed, 'lead', srcKey, pos.occurrence % COLOR_POOL, library, ORNAMENT_GAIN)
  if (!v) return null
  let stemId = v.stemId
  if (stemId === primaryLeadId) {                 // гарантируем различие двух лидов
    const leads = library.lead
    const i = leads.findIndex(s => s.id === stemId)
    stemId = leads[(i + 1) % leads.length].id
    if (stemId === primaryLeadId) return null      // в библиотеке один лид — орнамент пропускаем
  }
  return { role: 'lead', stemId, gain: ORNAMENT_GAIN }
}

/** Чистая детерминированная композиция. Единственное место музыкальных правил. */
export class MusicDirector {
  compose(seed: number, loopIndex: number, library: StemLibrary, remainingMs: number): Arrangement {
    const pos = sectionAt(loopIndex, remainingMs)
    const foundationVariant = Math.floor(loopIndex / PATTERN_LOOPS) % FOUNDATION_POOL
    const voices: VoiceSpec[] = []
    for (const role of SECTION_ROLES[pos.type]) {
      const v = voiceFor(role, pos, foundationVariant, seed, library)
      if (v) voices.push(v)
    }
    const orn = ornamentLead(pos, voices.find(v => v.role === 'lead')?.stemId, seed, library)
    if (orn && !voices.some(v => v.stemId === orn.stemId)) voices.push(orn)
    return voices
  }
}
