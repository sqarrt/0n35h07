import { seededRng } from '../util/seededRng'

/** Во сколько раз самый сильный бот (skill=1) офенсивнее самого слабого (skill=0). */
export const BOT_SKILL_CEILING_RATIO = 3.99

const FLAVOR = 0.08   // доля диапазона: случайный «характер» вокруг центра от skill

interface Anchor { weak: number; strong: number }
//                                  weak (s=0)   strong (s=1)
const HIT_CHANCE:    Anchor = { weak: 0.40,  strong: 0.798 }   // strong подобран под ratio = 3.99
const FIRE_INTERVAL: Anchor = { weak: 2800,  strong: 1400  }
const REACTION_MS:   Anchor = { weak: 320,   strong: 70    }
const DODGE_SKILL:   Anchor = { weak: 0.05,  strong: 0.95  }
const DASH_RATE:     Anchor = { weak: 0.03,  strong: 0.30  }
const JUMPINESS:     Anchor = { weak: 0.05,  strong: 0.45  }
const STRAFE_FLIP:   Anchor = { weak: 2000,  strong: 600   }
const AIM_NOISE:     Anchor = { weak: 0.12,  strong: 0.01  }   // legacy (используется до Task 2)
const GRAZE_MARGIN:  Anchor = { weak: 0.90,  strong: 0.15  }
const BAIT_SKILL:    Anchor = { weak: 0.05,  strong: 0.90  }
const EVADE_SKILL:   Anchor = { weak: 0.10,  strong: 0.95  }

export interface BotPersonality {
  skill:          number   // [0,1] — базовая сила из ника
  hitChance:      number   // вероятность попадания на выстрел (главный рычаг)
  fireIntervalMs: number   // период стрельбы
  reactionMs:     number   // задержка реакции на заряд соперника
  dodgeSkill:     number   // вероятность успешного уклонения
  dashRate:       number   // вероятность/сек дэша
  jumpiness:      number   // вероятность/сек прыжка
  strafeFlipMs:   number   // период смены направления стрейфа
  aimNoise:       number   // legacy 3D-шум прицела (удаляется в Task 2)
  grazeMargin:    number   // near-miss: доля BALL_RADIUS сверх края
  baitSkill:      number   // склонность разводить на щит
  evadeSkill:     number   // качество распрыжки-уклонения когда ведёт
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x }
function lerp(a: Anchor, s: number): number { return a.weak + (a.strong - a.weak) * s }

/** Сила бота из ника: детерминированно [0,1], равномерно. */
export function botSkill(name: string): number {
  return seededRng(name)()
}

/** Офенсивная сила (хиты/сек) при skill s — для инварианта потолка. */
export function offenseAt(s: number): number {
  return lerp(HIT_CHANCE, s) / (lerp(FIRE_INTERVAL, s) / 1000)
}

/** Детерминированная личность: skill из ника задаёт центр; флейвор-джиттер — отдельный поток. */
export function botPersonality(name: string): BotPersonality {
  const s = botSkill(name)
  const flav = seededRng(name + ':flavor')
  // значение = центр lerp(weak,strong, s±джиттер), джиттер из отдельного RNG (две близкие силы чуть разные)
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
    aimNoise:       p(AIM_NOISE),
    grazeMargin:    p(GRAZE_MARGIN),
    baitSkill:      p(BAIT_SKILL),
    evadeSkill:     p(EVADE_SKILL),
  }
}
