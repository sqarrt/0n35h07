import { announceKind } from '../game/streak'
import { unlockAchievement } from './steam'

/** Semantic sink for achievement-worthy events. The Match calls these for the LOCAL player only;
 *  implementations decide what (if anything) maps to a Steam achievement. (Dependency Inversion —
 *  the simulation never sees Steam API strings.) */
export interface IAchievements {
  /** Local player landed a kill. `streak` = their current killstreak, `firstBlood` = first frag of the match. */
  onKill(streak: number, firstBlood: boolean): void
  /** Local player perfectly blocked a shot. */
  onPerfectBlock(): void
  /** Match ended. `won` = local player won; `flawless` = won without dying. */
  onMatchEnd(won: boolean, flawless: boolean): void
}

/** Off-Steam default (unit tests, browser, Tauri without Steam): does nothing. */
export class NoopAchievements implements IAchievements {
  onKill(): void {}
  onPerfectBlock(): void {}
  onMatchEnd(): void {}
}

// The catalog: internal event → Steam achievement API name (defined in the Steamworks partner portal).
// announceKind's values ('catalyst'|'double'|'triple'|'singularity') are used as keys directly.
const ACH_KILL = {
  catalyst:    'ACH_CATALYST',      // first frag of a match
  double:      'ACH_DOUBLE_KILL',
  triple:      'ACH_TRIPLE_KILL',
  singularity: 'ACH_SINGULARITY',
} as const
const ACH_DEFLECTOR   = 'ACH_DEFLECTOR'     // a perfect block
const ACH_FIRST_WIN   = 'ACH_FIRST_WIN'     // win a match
const ACH_UNTOUCHABLE = 'ACH_UNTOUCHABLE'   // win without dying

/** Unlock function seam — overridable in tests; defaults to the real Steam bridge. */
type Unlock = (apiName: string) => void

/** Drives real Steam achievements through the bridge. De-dups so a repeat trigger
 *  (e.g. CATALYST every match) hits the bridge only once per session. */
export class SteamAchievements implements IAchievements {
  private readonly unlocked = new Set<string>()
  private readonly unlock: Unlock

  constructor(unlock: Unlock = (name) => { void unlockAchievement(name) }) {
    this.unlock = unlock
  }

  private fire(apiName: string): void {
    if (this.unlocked.has(apiName)) return
    this.unlocked.add(apiName)
    this.unlock(apiName)
  }

  onKill(streak: number, firstBlood: boolean): void {
    const kind = announceKind(streak, firstBlood)   // 'catalyst'|'double'|'triple'|'singularity'|null
    if (kind) this.fire(ACH_KILL[kind])
  }

  onPerfectBlock(): void {
    this.fire(ACH_DEFLECTOR)
  }

  onMatchEnd(won: boolean, flawless: boolean): void {
    if (!won) return
    this.fire(ACH_FIRST_WIN)
    if (flawless) this.fire(ACH_UNTOUCHABLE)
  }
}

/** Build the achievements sink for a real match. Self-gates: the bridge no-ops off-Steam. */
export function createAchievements(): IAchievements {
  return new SteamAchievements()
}
