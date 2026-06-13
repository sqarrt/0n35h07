import { IS_DESKTOP } from '../platform'

/**
 * Неймспейс матчмейкинга/транспорта: пулы разделяются ТОЧНОЙ версией игры и платформой
 * (десктоп ≠ браузер). Несовместимые пиры не пересекаются ни в discovery-корзинах, ни в
 * Trystero-комнате (appId), поэтому даже ручной вход по коду не сведёт разные версии/платформы.
 * Сплит ещё и дробит нагрузку Nostr-топиков — полезно при онлайне в десятки тысяч.
 */
export type ClientPlatform = 'desktop' | 'browser'

export const CLIENT_PLATFORM: ClientPlatform = IS_DESKTOP ? 'desktop' : 'browser'
export const CLIENT_VERSION = __APP_VERSION__
export const POOL_NAMESPACE = `${CLIENT_VERSION}:${CLIENT_PLATFORM}`
