/** Safe localStorage wrappers — swallow errors (private mode, quota). */

export function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function lsRemove(...keys: string[]): void {
  try { keys.forEach(k => localStorage.removeItem(k)) } catch { /* ignore */ }
}
