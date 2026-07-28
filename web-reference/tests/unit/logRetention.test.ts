import { describe, it, expect } from 'vitest'
import { LOG_FILE_RE, filesToPrune } from '../../src/diag/logRetention'

describe('logRetention', () => {
  it('matches only session log files', () => {
    expect(LOG_FILE_RE.test('oneshot-20260630-012203.log')).toBe(true)
    expect(LOG_FILE_RE.test('radio.json')).toBe(false)
    expect(LOG_FILE_RE.test('oneshot-bad.log')).toBe(false)
  })
  it('keeps the K newest by name, returns the rest to prune (ignoring non-log files)', () => {
    const names = ['oneshot-20260630-000001.log', 'oneshot-20260630-000003.log', 'oneshot-20260630-000002.log', 'notes.txt']
    expect(filesToPrune(names, 2).sort()).toEqual(['oneshot-20260630-000001.log'])
  })
  it('prunes nothing when at or under the cap', () => {
    expect(filesToPrune(['oneshot-20260630-000001.log'], 15)).toEqual([])
  })
})
