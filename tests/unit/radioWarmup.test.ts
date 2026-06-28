import { describe, it, expect, vi } from 'vitest'
import { warmupRadio } from '../../src/radio/warmup'
import type { RadioInitState } from '../../src/radio/warmup'

function recordingSetState() {
  const states: RadioInitState[] = []
  return { states, set: (s: RadioInitState) => states.push(s) }
}

const okSteps = () => ({
  loadBanks: vi.fn(async () => ({ banks: true })),
  makeEngine: vi.fn(() => ({ engine: true })),
  initEngine: vi.fn(async () => {}),
  makeController: vi.fn(() => ({ controller: true })),
})

describe('warmupRadio — init state machine', () => {
  it('success path: loading → ready, returns the controller, steps run in order', async () => {
    const { states, set } = recordingSetState()
    const steps = okSteps()
    const controller = await warmupRadio(steps, set)

    expect(states).toEqual(['loading', 'ready'])
    expect(controller).toEqual({ controller: true })
    expect(steps.loadBanks).toHaveBeenCalledOnce()
    expect(steps.initEngine).toHaveBeenCalledWith({ engine: true })
    expect(steps.makeController).toHaveBeenCalledWith({ engine: true }, { banks: true })
  })

  it('bank load failure: loading → error, returns null, later steps are skipped', async () => {
    const { states, set } = recordingSetState()
    const steps = okSteps()
    steps.loadBanks = vi.fn(async () => { throw new Error('404 moods.json') })

    const controller = await warmupRadio(steps, set)

    expect(states).toEqual(['loading', 'error'])
    expect(controller).toBeNull()
    expect(steps.initEngine).not.toHaveBeenCalled()
    expect(steps.makeController).not.toHaveBeenCalled()
  })

  it('engine init failure (e.g. AudioWorklet/CDN): loading → error, returns null', async () => {
    const { states, set } = recordingSetState()
    const steps = okSteps()
    steps.initEngine = vi.fn(async () => { throw new Error('AudioWorklet failed') })

    const controller = await warmupRadio(steps, set)

    expect(states).toEqual(['loading', 'error'])
    expect(controller).toBeNull()
    expect(steps.makeController).not.toHaveBeenCalled()
  })
})
