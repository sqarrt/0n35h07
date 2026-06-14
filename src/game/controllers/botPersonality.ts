export interface BotPersonality {
  reactionMs:   number   // 50–250  мс задержки перед реакцией на заряд соперника
  aimNoise:     number   // 0.01–0.12 рад  случайный угловой сдвиг прицела (масштаб × dist)
  dodgeSkill:   number   // 0.1–0.8  вероятность успешного уклонения (dash + jump)
  dashRate:     number   // 0.03–0.25  вероятность/сек дэша при уклонении/преследовании
  jumpiness:    number   // 0.05–0.40  вероятность/сек прыжка
  strafeFlipMs: number   // 600–2000 мс между сменой направления стрейфа
}

function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0
  return h
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/** Детерминированная личность бота: одно имя всегда даёт один и тот же набор параметров. */
export function botPersonality(name: string): BotPersonality {
  const rng = mulberry32(djb2(name))
  const r = (a: number, b: number) => a + rng() * (b - a)
  return {
    reactionMs:   r(50,   250),
    aimNoise:     r(0.01, 0.12),
    dodgeSkill:   r(0.1,  0.8),
    dashRate:     r(0.03, 0.25),
    jumpiness:    r(0.05, 0.40),
    strafeFlipMs: r(600,  2000),
  }
}
