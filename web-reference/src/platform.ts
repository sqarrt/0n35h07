/**
 * Runtime environment: desktop (Tauri) vs browser. In Tauri autoplay is allowed without a user
 * gesture → music starts immediately, unlike in the browser.
 */
export const IS_DESKTOP = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
