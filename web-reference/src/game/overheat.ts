import { STREAK_DOUBLE, STREAK_TRIPLE, STREAK_SINGULARITY } from './streakConfig'

const DOT_CAP = 10

export interface OverheatMods {
  speed: number        // movement speed multiplier
  beamCd: number       // beam cooldown multiplier
  shieldCd: number     // shield cooldown multiplier
  seeThrough: boolean  // visible through walls + can be shot through (SINGULARITY only)
}

const NEUTRAL: OverheatMods = { speed: 1, beamCd: 1, shieldCd: 1, seeThrough: false }

/** OVERHEAT modifiers by streak count. */
export function overheatMods(streak: number): OverheatMods {
  if (streak >= STREAK_SINGULARITY) return { speed: 1.3, beamCd: 1.5, shieldCd: 1.5, seeThrough: true }
  if (streak >= STREAK_TRIPLE)      return { speed: 1.2, beamCd: 1.3, shieldCd: 1.3, seeThrough: false }
  if (streak >= STREAK_DOUBLE)      return { speed: 1.1, beamCd: 1.15, shieldCd: 1.15, seeThrough: false }
  return NEUTRAL
}

/** Frags per kill by the VICTIM's streak (before reset): TRIPLE→2, SINGULARITY→3, otherwise 1. */
export function bountyFrags(victimStreak: number): number {
  if (victimStreak >= STREAK_SINGULARITY) return 3
  if (victimStreak >= STREAK_TRIPLE) return 2
  return 1
}

/** Breaking a TRIPLE+ streak resets the killer's cooldowns. */
export function breakResetsCooldowns(victimStreak: number): boolean {
  return victimStreak >= STREAK_TRIPLE
}

/** Dots next to the name = streak, capped at 10. */
export function streakDots(streak: number): number {
  return Math.min(Math.max(streak, 0), DOT_CAP)
}
