/** Контекст решения об уклонении (распрыжке). */
export interface EvadeContext {
  kills:        number   // очки бота
  oppKills:     number   // очки соперника
  oppWindingUp: boolean  // соперник заряжает выстрел
  hasLOS:       boolean  // соперник в прямой видимости
  dist:         number   // дистанция до соперника
  evadeNear:    number   // порог «вплотную»
}

/**
 * Бот ведёт по очкам И под угрозой → выгодно уклоняться распрыжкой.
 * Угроза = соперник заряжает в прямой видимости, либо подошёл вплотную (dist < evadeNear).
 * Когда ведёшь — рациональнее «тянуть время» и не подставляться, как живой игрок.
 */
export function shouldEvade(c: EvadeContext): boolean {
  if (c.kills <= c.oppKills) return false
  return (c.oppWindingUp && c.hasLOS) || c.dist < c.evadeNear
}
