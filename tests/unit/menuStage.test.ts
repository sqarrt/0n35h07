import { describe, it, expect } from 'vitest'
import { cameraStateFor, PLAYER_SPOT, OPPONENT_SPOT } from '../../src/components/menuStage'
import rawPoses from '../../src/components/menuCameraPoses.json'

describe('cameraStateFor', () => {
  it('внешность: ракурс по последнему кликнутому блоку', () => {
    expect(cameraStateFor('appearance', false, 'color')).toBe('appearance')
    expect(cameraStateFor('appearance', false, 'model')).toBe('appearance')
    expect(cameraStateFor('appearance', false, 'shot')).toBe('appearanceShot')
    expect(cameraStateFor('appearance', false, 'respawn')).toBe('appearanceRespawn')
  })

  it('лобби: особый ракурс только вдвоём; остальные экраны — дефолт', () => {
    expect(cameraStateFor('lobby', true, 'color')).toBe('lobby')
    expect(cameraStateFor('lobby', false, 'color')).toBe('default')
    expect(cameraStateFor('menu', false, 'color')).toBe('default')
    expect(cameraStateFor('join', false, 'respawn')).toBe('default')   // part вне внешности не влияет
    expect(cameraStateFor('settings', false, 'color')).toBe('default')
  })
})

describe('menuCameraPoses.json', () => {
  it('содержит позу для каждого состояния (position и target — тройки чисел)', () => {
    const states = ['default', 'lobby', 'appearance', 'appearanceShot', 'appearanceRespawn'] as const
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
