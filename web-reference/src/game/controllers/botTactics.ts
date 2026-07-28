/** Context for the evade (bunny-hop) decision. */
export interface EvadeContext {
  kills:        number   // bot's score
  oppKills:     number   // opponent's score
  oppWindingUp: boolean  // opponent is charging a shot
  hasLOS:       boolean  // opponent is in line of sight
  dist:         number   // distance to opponent
  evadeNear:    number   // "point-blank" threshold
}

/**
 * Bot is ahead on score AND under threat -> evading by bunny-hopping pays off.
 * Threat = opponent charging in LOS, or closed in point-blank (dist < evadeNear).
 * When ahead, it's smarter to "play for time" and not expose yourself, like a real player.
 */
export function shouldEvade(c: EvadeContext): boolean {
  if (c.kills <= c.oppKills) return false
  return (c.oppWindingUp && c.hasLOS) || c.dist < c.evadeNear
}
