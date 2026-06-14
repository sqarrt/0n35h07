import type { SfxEvent } from './audio/sfx/types'

/** Тир подсветки ника (по числу серии). */
export type StreakTier = 'double' | 'triple' | 'singularity'
/** Что анонсировать баннером (тир серии ЛИБО первое убийство). */
export type AnnounceKind = 'catalyst' | StreakTier

import { STREAK_DOUBLE, STREAK_TRIPLE, STREAK_SINGULARITY } from './streakConfig'

/** Тир для постоянной подсветки ника; 0–1 → null. */
export function streakTier(streak: number): StreakTier | null {
  if (streak >= STREAK_SINGULARITY) return 'singularity'
  if (streak >= STREAK_TRIPLE) return 'triple'
  if (streak >= STREAK_DOUBLE) return 'double'
  return null
}

/** Нужен ли баннер на этом фраге: первая кровь ИЛИ точный порог смены слова тира. */
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
