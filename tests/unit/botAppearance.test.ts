import { describe, it, expect } from 'vitest'
import { botAppearance } from '../../src/game/botAppearance'
import { PLAYER_COLORS, BALL_MODELS, WINDUP_STYLES, RESPAWN_STYLES, DASH_STYLES, SHIELD_STYLES } from '../../src/constants'

describe('botAppearance', () => {
  it('deterministic: one nick → the same skin', () => {
    expect(botAppearance('RA9')).toEqual(botAppearance('RA9'))
  })

  it('all values are valid (belong to their sets)', () => {
    const a = botAppearance('T-2000')
    expect(PLAYER_COLORS).toContain(a.color)
    expect(BALL_MODELS).toContain(a.ballModel)
    expect(WINDUP_STYLES).toContain(a.windupStyle)
    expect(RESPAWN_STYLES).toContain(a.respawnStyle)
    expect(DASH_STYLES).toContain(a.dashStyle)
    expect(SHIELD_STYLES).toContain(a.shieldStyle)
  })

  it('distinctness: different nicks do not yield the same skin', () => {
    const names = ['RA9', 'T-2000', 'RTX4080', 'AX12S', 'QZ7', 'MK3', 'NOVA', 'ZX9']
    const colors = new Set(names.map(n => botAppearance(n).color))
    const models = new Set(names.map(n => botAppearance(n).ballModel))
    expect(colors.size).toBeGreaterThan(1)
    expect(models.size).toBeGreaterThan(1)
  })
})
