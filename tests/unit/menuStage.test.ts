import { describe, it, expect } from 'vitest'
import { cameraStateFor, PLAYER_SPOT, OPPONENT_SPOT } from '../../src/components/menuStage'
import rawPoses from '../../src/components/menuCameraPoses.json'

describe('cameraStateFor', () => {
  it('appearance: angle based on the last clicked block', () => {
    expect(cameraStateFor('appearance', false, false, 'color')).toBe('appearance')
    expect(cameraStateFor('appearance', false, false, 'model')).toBe('appearance')
    expect(cameraStateFor('appearance', false, false, 'shot')).toBe('appearanceShot')
    expect(cameraStateFor('appearance', false, false, 'respawn')).toBe('appearanceRespawn')
    expect(cameraStateFor('appearance', false, false, 'dash')).toBe('appearanceDash')
    expect(cameraStateFor('appearance', false, false, 'shield')).toBe('appearanceShield')
  })

  it('lobby: special angle only when paired (host and client differ); other screens — default', () => {
    expect(cameraStateFor('lobby', true, false, 'color')).toBe('room')
    expect(cameraStateFor('lobby', true, true, 'color')).toBe('roomClient')
    expect(cameraStateFor('lobby', false, false, 'color')).toBe('default')
    expect(cameraStateFor('menu', false, false, 'color')).toBe('default')
    expect(cameraStateFor('lobby', false, true, 'respawn')).toBe('default')   // part/client without an opponent have no effect
    expect(cameraStateFor('settings', false, false, 'color')).toBe('default')
  })
})

describe('menuCameraPoses.json', () => {
  it('contains a pose for every state (position and target — number triples)', () => {
    const states = ['default', 'room', 'roomClient', 'appearance', 'appearanceShot', 'appearanceRespawn', 'appearanceDash', 'appearanceShield'] as const
    for (const s of states) {
      const pose = (rawPoses as Record<string, { position: number[]; target: number[] }>)[s]
      expect(pose, s).toBeDefined()
      expect(pose.position).toHaveLength(3)
      expect(pose.target).toHaveLength(3)
    }
  })
})

describe('stage spots', () => {
  it('players at different spots, at eye height', () => {
    expect(PLAYER_SPOT.distanceTo(OPPONENT_SPOT)).toBeGreaterThan(1)
    expect(PLAYER_SPOT.y).toBe(OPPONENT_SPOT.y)
  })
})
