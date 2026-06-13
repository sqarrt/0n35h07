/**
 * Среда исполнения: десктоп (Tauri) vs браузер. В Tauri autoplay разрешён без пользовательского
 * жеста → музыка стартует сразу, в отличие от браузера.
 */
export const IS_DESKTOP = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
