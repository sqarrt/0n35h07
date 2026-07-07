import { PLAYER_COLORS, BALL_MODELS, WINDUP_STYLES, RESPAWN_STYLES, DASH_STYLES, SHIELD_STYLES } from '../constants'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'
import { seededRng } from './util/seededRng'

export interface BotAppearance {
  color:        string
  reserveColor: string   // second appearance color (ring etc.) — same pair semantics as a human profile
  ballModel:    BallModel
  windupStyle:  WindupStyle
  respawnStyle: RespawnStyle
  dashStyle:    DashStyle
  shieldStyle:  ShieldStyle
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Deterministic bot skin from name: same name → same look (shared seed with botPersonality). */
export function botAppearance(name: string): BotAppearance {
  const rng = seededRng(name)
  const color = pick(rng, PLAYER_COLORS)
  const look = {
    color,
    ballModel:    pick(rng, BALL_MODELS),
    windupStyle:  pick(rng, WINDUP_STYLES),
    respawnStyle: pick(rng, RESPAWN_STYLES),
    dashStyle:    pick(rng, DASH_STYLES),
    shieldStyle:  pick(rng, SHIELD_STYLES),
  }
  // reserve is drawn LAST: appended later than the other fields, so existing bots keep their look for the same name
  return { ...look, reserveColor: pick(rng, PLAYER_COLORS.filter(c => c !== color)) }
}
