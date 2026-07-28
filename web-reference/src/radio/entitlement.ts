// Free daily trial for the Radio (a paid Steam DLC unlocks unlimited). Pure logic — no Steam/IO, unit-tested
// with an injected `now`. One generation = one new live track; one save = a player→library add.

export const FREE_GENS_PER_DAY = 10
export const FREE_SAVES_PER_DAY = 5

export interface RadioTrial { day: string; gens: number; saves: number } // day = local YYYY-MM-DD

/** Local calendar day key, e.g. "2026-06-28". */
export function todayKey(now: Date): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), dd = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function emptyTrial(now: Date): RadioTrial { return { day: todayKey(now), gens: 0, saves: 0 } }

/** Advance the trial to `now`'s day. New day → reset counters. Same day → unchanged. Clock moved BACK
 *  (today < stored day) → keep the stored day + counts (no free reset by winding the clock back). */
export function rollTrial(t: RadioTrial | undefined, now: Date): RadioTrial {
  const today = todayKey(now)
  if (!t) return { day: today, gens: 0, saves: 0 }
  if (today > t.day) return { day: today, gens: 0, saves: 0 }
  return t // today === t.day, or today < t.day (backward clock) → unchanged
}

export interface Entitlement { unlimited: boolean; gensLeft: number; savesLeft: number; canGenerate: boolean; canSave: boolean }

export function entitlementFor(o: { owned: boolean; devUnlimited: boolean; trial: RadioTrial }): Entitlement {
  const unlimited = o.owned || o.devUnlimited
  const gensLeft = unlimited ? Infinity : Math.max(0, FREE_GENS_PER_DAY - o.trial.gens)
  const savesLeft = unlimited ? Infinity : Math.max(0, FREE_SAVES_PER_DAY - o.trial.saves)
  return { unlimited, gensLeft, savesLeft, canGenerate: gensLeft > 0, canSave: savesLeft > 0 }
}

export function consumeGen(t: RadioTrial, now: Date): RadioTrial { const r = rollTrial(t, now); return { ...r, gens: r.gens + 1 } }
export function consumeSave(t: RadioTrial, now: Date): RadioTrial { const r = rollTrial(t, now); return { ...r, saves: r.saves + 1 } }
