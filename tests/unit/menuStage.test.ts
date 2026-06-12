import { describe, it, expect } from 'vitest'
import { cameraStateFor, PLAYER_SPOT, OPPONENT_SPOT } from '../../src/components/menuStage'
import rawPoses from '../../src/components/menuCameraPoses.json'

describe('cameraStateFor', () => {
  it('внешность: ракурс по последнему кликнутому блоку', () => {
    expect(cameraStateFor('appearance', false, false, 'color')).toBe('appearance')
    expect(cameraStateFor('appearance', false, false, 'model')).toBe('appearance')
    expect(cameraStateFor('appearance', false, false, 'shot')).toBe('appearanceShot')
    expect(cameraStateFor('appearance', false, false, 'respawn')).toBe('appearanceRespawn')
    expect(cameraStateFor('appearance', false, false, 'dash')).toBe('appearanceDash')
    expect(cameraStateFor('appearance', false, false, 'shield')).toBe('appearanceShield')
  })

  it('лобби: особый ракурс только вдвоём (хост и клиент — разные); остальные экраны — дефолт', () => {
    expect(cameraStateFor('lobby', true, false, 'color')).toBe('room')
    expect(cameraStateFor('lobby', true, true, 'color')).toBe('roomClient')
    expect(cameraStateFor('lobby', false, false, 'color')).toBe('default')
    expect(cameraStateFor('menu', false, false, 'color')).toBe('default')
    expect(cameraStateFor('lobby', false, true, 'respawn')).toBe('default')   // part/клиент без соперника не влияют
    expect(cameraStateFor('settings', false, false, 'color')).toBe('default')
  })
})

describe('menuCameraPoses.json', () => {
  it('содержит позу для каждого состояния (position и target — тройки чисел)', () => {
    const states = ['default', 'room', 'roomClient', 'appearance', 'appearanceShot', 'appearanceRespawn', 'appearanceDash', 'appearanceShield'] as const
    for (const s of states) {
      const pose = (rawPoses as Record<string, { position: number[]; target: number[] }>)[s]
      expect(pose, s).toBeDefined()
      expect(pose.position).toHaveLength(3)
      expect(pose.target).toHaveLength(3)
    }
  })
})

describe('сценические точки', () => {
  it('игроки на разных точках, на высоте глаз', () => {
    expect(PLAYER_SPOT.distanceTo(OPPONENT_SPOT)).toBeGreaterThan(1)
    expect(PLAYER_SPOT.y).toBe(OPPONENT_SPOT.y)
  })
})
