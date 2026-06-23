/** Settings tabs. Kept separate from Settings.tsx so the visibility rule is a pure,
 *  unit-testable function with no React/network import chain. */
export type SettingsSection = 'player' | 'sound' | 'net' | 'graphics' | 'about'

const ALL_SECTIONS: SettingsSection[] = ['player', 'sound', 'net', 'graphics', 'about']

/**
 * Visible settings tabs for the current platform. The "net" tab is Trystero/relay-only
 * (search role, connect timeout, relay health) — irrelevant on the Steam/desktop build,
 * where matches run over SteamNet (SDR), so it's hidden there.
 */
export function visibleSections(isDesktop: boolean): SettingsSection[] {
  return isDesktop ? ALL_SECTIONS.filter(s => s !== 'net') : ALL_SECTIONS
}
