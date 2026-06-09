/**
 * Среда исполнения: Electron-десктоп vs браузер. В Electron autoplay разрешён без пользовательского
 * жеста (см. autoplay-policy в electron/main.ts) → музыка стартует сразу, в отличие от браузера.
 */
export const IS_ELECTRON = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
