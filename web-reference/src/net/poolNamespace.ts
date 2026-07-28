import { IS_DESKTOP } from '../platform'

/**
 * Matchmaking/transport namespace: pools are split by the EXACT game version and platform
 * (desktop ≠ browser). Incompatible peers don't overlap in discovery buckets or in the
 * Trystero room (appId), so even a manual code join won't connect different versions/platforms.
 * The split also shards Nostr topic load — useful with tens of thousands online.
 */
export type ClientPlatform = 'desktop' | 'browser'

export const CLIENT_PLATFORM: ClientPlatform = IS_DESKTOP ? 'desktop' : 'browser'
export const CLIENT_VERSION = __APP_VERSION__
export const POOL_NAMESPACE = `${CLIENT_VERSION}:${CLIENT_PLATFORM}`
