import type { SfxEvent } from './audio/sfx/types'

/** Nickname highlight tier (by streak count). */
export type StreakTier = 'double' | 'triple' | 'singularity'
/** What the banner announces (streak tier OR first kill). */
export type AnnounceKind = 'catalyst' | StreakTier

import { STREAK_DOUBLE, STREAK_TRIPLE, STREAK_SINGULARITY } from './streakConfig'

/** Tier for the persistent nickname highlight; 0–1 → null. */
export function streakTier(streak: number): StreakTier | null {
  if (streak >= STREAK_SINGULARITY) return 'singularity'
  if (streak >= STREAK_TRIPLE) return 'triple'
  if (streak >= STREAK_DOUBLE) return 'double'
  return null
}

/** Whether this frag needs a banner: first blood OR an exact tier-word threshold. */
export function announceKind(streak: number, firstBlood: boolean): AnnounceKind | null {
  if (firstBlood) return 'catalyst'
  if (streak === STREAK_SINGULARITY) return 'singularity'
  if (streak === STREAK_TRIPLE) return 'triple'
  if (streak === STREAK_DOUBLE) return 'double'
  return null
}

export function tierWord(k: AnnounceKind): string {
  switch (k) {
    case 'catalyst': return 'CATALYST'
    case 'double': return 'DOUBLE KILL'
    case 'triple': return 'TRIPLE KILL'
    case 'singularity': return 'SINGULARITY'
  }
}

export function announceSfx(k: AnnounceKind): SfxEvent {
  switch (k) {
    case 'catalyst': return 'catalyst'
    case 'double': return 'double_kill'
    case 'triple': return 'triple_kill'
    case 'singularity': return 'singularity'
  }
}
