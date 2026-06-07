import type { Role, StemLibrary, Arrangement, VoiceSpec } from './types'
import { mulberry32 } from './rng'

// --- ПРАВИЛА КОМПОЗИЦИИ (тюнятся здесь — константами ИЛИ переписыванием алгоритма) ---
const INTRO_LOOPS = 2        // столько 8с-лупов играют только kicks+bass до вступления остального
const SWAP_EVERY_LOOPS = 4   // как часто можно сменить выбранный стем внутри роли
const ROLE_GAIN: Record<Role, number> = { bass: 0.9, kicks: 1.0, lead: 0.7, sfx: 0.5 }
const ROLE_SALT: Record<Role, number> = { bass: 0x1111, kicks: 0x2222, lead: 0x3333, sfx: 0x4444 }
const CYCLE_MIX = 0x9E3779B1   // золотое сечение — перемешивает номер цикла подмены

const INTRO_ROLES: Role[] = ['kicks', 'bass']
const FULL_ROLES: Role[] = ['kicks', 'bass', 'lead', 'sfx']

function pickVoice(role: Role, seed: number, cycle: number, library: StemLibrary): VoiceSpec | null {
  const stems = library[role]
  if (stems.length === 0) return null
  const rng = mulberry32((seed ^ ROLE_SALT[role] ^ Math.imul(cycle + 1, CYCLE_MIX)) >>> 0)
  const idx = Math.floor(rng() * stems.length)
  return { role, stemId: stems[idx].id, gain: ROLE_GAIN[role] }
}

/** Чистая детерминированная композиция. Единственное место музыкальных правил. */
export class MusicDirector {
  compose(seed: number, loopIndex: number, library: StemLibrary): Arrangement {
    const cycle = Math.floor(loopIndex / SWAP_EVERY_LOOPS)
    const roles = loopIndex < INTRO_LOOPS ? INTRO_ROLES : FULL_ROLES
    const voices: VoiceSpec[] = []
    for (const role of roles) {
      const v = pickVoice(role, seed, cycle, library)
      if (v) voices.push(v)
    }
    return voices
  }
}
