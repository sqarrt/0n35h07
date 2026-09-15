import { describe, expect, it } from 'vitest'
import { dispatch, parseCommand, type HostTarget } from '../../src/radio/host/hostProtocol'

const BAKED = { name: 'Iron Verdict', bpm: 128, bars: 64, info: { mood: 'dark', key: 'E', scale: 'phrygian' }, program: 'silence' }

/** A HostTarget that records every call as [method, ...args]. */
function recorder(): { calls: unknown[][]; target: HostTarget } {
  const calls: unknown[][] = []
  const target = new Proxy({}, {
    get: (_, method) => (...args: unknown[]) => { calls.push([method, ...args]) },
  }) as HostTarget
  return { calls, target }
}

describe('radio host protocol', () => {
  it('dispatches each Godot command to the matching controller call', () => {
    const cases: [string, unknown[]][] = [
      ['{"cmd":"init","volume":0.64}', ['init', 0.64]],
      ['{"cmd":"resume"}', ['resume']],
      ['{"cmd":"pause"}', ['pause']],
      ['{"cmd":"stop"}', ['stop']],
      ['{"cmd":"next"}', ['next']],
      ['{"cmd":"prev"}', ['prev']],
      ['{"cmd":"resume-generative"}', ['resumeGenerative']],
      ['{"cmd":"seek","frac":0.25}', ['seek', 0.25]],
      ['{"cmd":"volume","value":0.5}', ['setVolume', 0.5]],
      ['{"cmd":"gate","canGenerate":false}', ['setGate', false]],
      ['{"cmd":"play-track","seed":"abc","index":3}', ['playTrack', 'abc', 3]],
      [JSON.stringify({ cmd: 'play-baked', track: BAKED }), ['playBaked', BAKED]],
    ]
    for (const [text, call] of cases) {
      const { calls, target } = recorder()
      const command = parseCommand(text)
      expect(command, text).not.toBeNull()
      dispatch(command!, target)
      expect(calls, text).toEqual([call])
    }
  })

  it('ignores anything malformed', () => {
    for (const text of ['not json', 'null', '[]', '{"cmd":"launch"}', '{"cmd":"seek"}', '{"cmd":"volume","value":"loud"}',
      '{"cmd":"gate","canGenerate":1}', '{"cmd":"play-track","seed":7,"index":1}', '{"cmd":"play-baked","track":{"name":"x"}}',
      '{"cmd":"init","volume":null}']) {
      expect(parseCommand(text), text).toBeNull()
    }
  })
})
