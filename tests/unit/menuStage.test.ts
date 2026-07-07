import { describe, it, expect } from 'vitest'
import { cameraStateFor, PLAYER_SPOT, OPPONENT_SPOT, STAGE_SPOTS } from '../../src/components/menuStage'
import rawPoses from '../../src/components/menuCameraPoses.json'

describe('cameraStateFor', () => {
  it('appearance: angle based on the last clicked block', () => {
    expect(cameraStateFor('appearance', '1v1', false, 'color')).toBe('appearance')
    expect(cameraStateFor('appearance', '1v1', false, 'model')).toBe('appearance')
    expect(cameraStateFor('appearance', '1v1', false, 'shot')).toBe('appearanceShot')
    expect(cameraStateFor('appearance', '1v1', false, 'respawn')).toBe('appearanceRespawn')
    expect(cameraStateFor('appearance', '1v1', false, 'dash')).toBe('appearanceDash')
    expect(cameraStateFor('appearance', '1v1', false, 'shield')).toBe('appearanceShield')
  })

  it('lobby: поза следует РЕЖИМУ — Duel парная (у гостя свой ракурс), Battle/War — квадрат', () => {
    expect(cameraStateFor('lobby', '1v1', false, 'color')).toBe('room')
    expect(cameraStateFor('lobby', '1v1', true, 'color')).toBe('roomClient')
    expect(cameraStateFor('lobby', '2v2', false, 'color')).toBe('lobby4')
    expect(cameraStateFor('lobby', '2v2', true, 'color')).toBe('lobby4')
    expect(cameraStateFor('lobby', 'ffa', false, 'color')).toBe('lobby4')
    expect(cameraStateFor('menu', '1v1', false, 'color')).toBe('default')
    expect(cameraStateFor('settings', 'ffa', false, 'color')).toBe('default')
  })
})

describe('menuCameraPoses.json', () => {
  it('contains a pose for every state (position and target — number triples)', () => {
    const states = ['default', 'room', 'roomClient', 'lobby4', 'appearance', 'appearanceShot', 'appearanceRespawn', 'appearanceDash', 'appearanceShield'] as const
    for (const s of states) {
      const pose = (rawPoses as Record<string, { position: number[]; target: number[] }>)[s]
      expect(pose, s).toBeDefined()
      expect(pose.position).toHaveLength(3)
      expect(pose.target).toHaveLength(3)
    }
  })
})

describe('stage spots', () => {
  it('4 спота: слоты 0/1 — классическая пара, все на высоте глаз, попарно различны', () => {
    expect(STAGE_SPOTS).toHaveLength(4)
    expect(PLAYER_SPOT).toBe(STAGE_SPOTS[0])
    expect(OPPONENT_SPOT).toBe(STAGE_SPOTS[1])
    for (let i = 0; i < STAGE_SPOTS.length; i++) {
      expect(STAGE_SPOTS[i].y).toBe(PLAYER_SPOT.y)
      for (let j = i + 1; j < STAGE_SPOTS.length; j++) {
        expect(STAGE_SPOTS[i].distanceTo(STAGE_SPOTS[j]), `${i}-${j}`).toBeGreaterThan(1)
      }
    }
  })
})
