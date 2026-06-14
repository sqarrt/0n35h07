import { STREAK_DOUBLE, STREAK_TRIPLE, STREAK_SINGULARITY } from './streakConfig'

const DOT_CAP = 10

export interface OverheatMods {
  speed: number        // множитель скорости движения
  beamCd: number       // множитель кулдауна луча
  shieldCd: number     // множитель кулдауна щита
  seeThrough: boolean  // виден сквозь стены + простреливается (только SINGULARITY)
}

const NEUTRAL: OverheatMods = { speed: 1, beamCd: 1, shieldCd: 1, seeThrough: false }

/** Модификаторы ПЕРЕГРЕВА по числу серии. */
export function overheatMods(streak: number): OverheatMods {
  if (streak >= STREAK_SINGULARITY) return { speed: 1.3, beamCd: 1.5, shieldCd: 1.5, seeThrough: true }
  if (streak >= STREAK_TRIPLE)      return { speed: 1.2, beamCd: 1.3, shieldCd: 1.3, seeThrough: false }
  if (streak >= STREAK_DOUBLE)      return { speed: 1.1, beamCd: 1.15, shieldCd: 1.15, seeThrough: false }
  return NEUTRAL
}

/** Фраги за килл по серии ЖЕРТВЫ (до сброса): TRIPLE→2, SINGULARITY→3, иначе 1. */
export function bountyFrags(victimStreak: number): number {
  if (victimStreak >= STREAK_SINGULARITY) return 3
  if (victimStreak >= STREAK_TRIPLE) return 2
  return 1
}

/** Снятие серии TRIPLE+ сбрасывает кулдауны убийцы. */
export function breakResetsCooldowns(victimStreak: number): boolean {
  return victimStreak >= STREAK_TRIPLE
}

/** Точек у имени = серия, кап 10. */
export function streakDots(streak: number): number {
  return Math.min(Math.max(streak, 0), DOT_CAP)
}
