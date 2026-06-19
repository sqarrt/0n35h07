import { seededRng } from '../util/seededRng'

export interface BotPersonality {
  reactionMs:   number   // 50–250  мс задержки перед реакцией на заряд соперника
  aimNoise:     number   // 0.01–0.12 рад  случайный угловой сдвиг прицела (масштаб × dist)
  dodgeSkill:   number   // 0.1–0.8  вероятность успешного уклонения (dash + jump)
  dashRate:     number   // 0.03–0.25  вероятность/сек дэша при уклонении/преследовании
  jumpiness:    number   // 0.05–0.40  вероятность/сек прыжка
  strafeFlipMs: number   // 600–2000 мс между сменой направления стрейфа
}

/** Детерминированная личность бота: одно имя всегда даёт один и тот же набор параметров. */
export function botPersonality(name: string): BotPersonality {
  const rng = seededRng(name)
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
