import { randomProfile } from '../../../src/settings'
import type { PlayerProfile } from '../../../src/settings'
import { PLAYER_COLORS } from '../../../src/constants'

// Identity of a fixture profile: pinned so the fixture is deterministic (randomProfile() rolls
// name + colors at random — a test must never depend on a dice roll). Everything else comes
// from the prod default, so a new PlayerProfile field can never rot the fixtures again.
const FIXTURE_NAME = 'Test'
const FIXTURE_PRIMARY = PLAYER_COLORS[0]
const FIXTURE_RESERVE = PLAYER_COLORS[1]

/**
 * A complete PlayerProfile for tests: the prod default (randomProfile) with a deterministic
 * identity, plus whatever the test actually asserts on.
 * Usage: testProfile({ name: 'Guest', primaryColor: '#fd4' }) — override ONLY what matters.
 */
export function testProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    ...randomProfile(),
    name: FIXTURE_NAME,
    primaryColor: FIXTURE_PRIMARY,
    reserveColor: FIXTURE_RESERVE,
    ...overrides,
  }
}
