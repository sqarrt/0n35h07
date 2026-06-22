import { seededRng } from '../util/seededRng'

/** How many times more offensive the strongest bot (skill=1) is than the weakest (skill=0). */
export const BOT_SKILL_CEILING_RATIO = 3.99

const FLAVOR = 0.08   // fraction of the range: random "character" around the skill-derived center

interface Anchor { weak: number; strong: number }
//                                  weak (s=0)   strong (s=1)
const HIT_CHANCE:    Anchor = { weak: 0.40,  strong: 0.798 }   // strong tuned for ratio = 3.99
const FIRE_INTERVAL: Anchor = { weak: 2800,  strong: 1400  }
const REACTION_MS:   Anchor = { weak: 320,   strong: 70    }
const DODGE_SKILL:   Anchor = { weak: 0.05,  strong: 0.95  }
const DASH_RATE:     Anchor = { weak: 0.03,  strong: 0.30  }
const JUMPINESS:     Anchor = { weak: 0.05,  strong: 0.45  }
const STRAFE_FLIP:   Anchor = { weak: 2000,  strong: 600   }
const GRAZE_MARGIN:  Anchor = { weak: 0.90,  strong: 0.15  }   // near-miss: fraction of BALL_RADIUS past the hitbox edge
const BAIT_SKILL:    Anchor = { weak: 0.05,  strong: 0.90  }
const EVADE_SKILL:   Anchor = { weak: 0.10,  strong: 0.95  }

export interface BotPersonality {
  skill:          number   // [0,1] — base strength from the name
  hitChance:      number   // hit probability per shot (the main lever)
  fireIntervalMs: number   // firing period
  reactionMs:     number   // reaction delay to the opponent's windup
  dodgeSkill:     number   // probability of a successful dodge
  dashRate:       number   // dash probability/sec
  jumpiness:      number   // jump probability/sec
  strafeFlipMs:   number   // strafe direction flip period
  grazeMargin:    number   // near-miss: fraction of BALL_RADIUS past the edge
  baitSkill:      number   // tendency to bait the shield
  evadeSkill:     number   // bunny-hop evasion quality when leading
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x }
function lerp(a: Anchor, s: number): number { return a.weak + (a.strong - a.weak) * s }

/** Bot strength from the name: deterministic [0,1], uniform. */
export function botSkill(name: string): number {
  return seededRng(name)()
}

/** Offensive strength (hits/sec) at skill s — for the ceiling invariant. */
export function offenseAt(s: number): number {
  return lerp(HIT_CHANCE, s) / (lerp(FIRE_INTERVAL, s) / 1000)
}

/** Deterministic personality: skill from the name sets the center; flavor jitter is a separate stream. */
export function botPersonality(name: string): BotPersonality {
  const s = botSkill(name)
  const flav = seededRng(name + ':flavor')
  // value = center lerp(weak,strong, s±jitter), jitter from a separate RNG (two close strengths differ slightly)
  const p = (a: Anchor) => lerp(a, clamp01(s + (flav() - 0.5) * 2 * FLAVOR))
  return {
    skill:          s,
    hitChance:      p(HIT_CHANCE),
    fireIntervalMs: p(FIRE_INTERVAL),
    reactionMs:     p(REACTION_MS),
    dodgeSkill:     p(DODGE_SKILL),
    dashRate:       p(DASH_RATE),
    jumpiness:      p(JUMPINESS),
    strafeFlipMs:   p(STRAFE_FLIP),
    grazeMargin:    p(GRAZE_MARGIN),
    baitSkill:      p(BAIT_SKILL),
    evadeSkill:     p(EVADE_SKILL),
  }
}
