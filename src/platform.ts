/**
 * Среда исполнения: Electron-десктоп vs браузер. В Electron нет браузерных ограничений,
 * которые в вебе приходится обходить:
 *  - PointerLock без ~1.25с кулдауна Chrome → кнопка «Продолжить» активна сразу (без таймера);
 *  - autoplay без пользовательского жеста → музыка стартует сразу (см. autoplay-policy в electron/main.ts).
 */
export const IS_ELECTRON = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
