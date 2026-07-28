import type { CSSProperties } from 'react'
import { Slider } from '../ui/Slider'
import { Toggle } from '../ui/Toggle'
import { IS_DESKTOP } from '../platform'
import { useT } from '../i18n'
import { saveProfile } from '../settings'
import type { PlayerProfile } from '../settings'

/**
 * Reusable Sound / Graphics control groups, shared by the full Settings screen and the in-match
 * pause panel. Each control writes directly to the profile: `saveProfile(next)` + `onChange(next)`
 * (the parent owns the profile state), so changes persist and apply live.
 */

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }
const subHeader: CSSProperties = {
  color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.18em',
  marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-line)',
}

interface ControlsProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
}

function persist(profile: PlayerProfile, onChange: (p: PlayerProfile) => void, patch: Partial<PlayerProfile>): void {
  const next = { ...profile, ...patch }
  saveProfile(next)
  onChange(next)
}

/** Toggle + its label on one row (shared markup for the graphics switches). */
function ToggleRow({ checked, onChange, label: text, testid }: { checked: boolean; onChange: (v: boolean) => void; label: string; testid: string }) {
  return (
    <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
      <Toggle checked={checked} onChange={onChange} aria-label={text} data-testid={testid} />
      <span style={{ ...label, marginBottom: 0 }}>{text}</span>
    </div>
  )
}

/** Volume sliders (master / music / menu music / sfx / radio). `radioReady`: false greys the radio slider
 *  out until the radio module has initialised. */
export function SoundControls({ profile, onChange, radioReady }: ControlsProps & { radioReady?: boolean }) {
  const t = useT()
  const set = (patch: Partial<PlayerProfile>) => persist(profile, onChange, patch)
  return (
    <>
      <div style={subHeader}>{t.settingsVolumeGroup}</div>
      <Slider label={t.settingsVolMaster} value={profile.volumeMaster} onChange={v => set({ volumeMaster: v })} />
      <Slider label={t.settingsVolMusic} value={profile.volumeMusic} onChange={v => set({ volumeMusic: v })} />
      <Slider label={t.settingsVolMenuMusic} value={profile.volumeMenuMusic} onChange={v => set({ volumeMenuMusic: v })} />
      <Slider label={t.settingsVolSfx} value={profile.volumeSfx} onChange={v => set({ volumeSfx: v })} />
      {/* Radio volume — desktop only. Greyed until the module initialises. */}
      {IS_DESKTOP && (
        <div style={radioReady === false ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          <Slider label={t.settingsVolRadio} value={profile.volumeRadio} onChange={v => set({ volumeRadio: v })} />
        </div>
      )}
    </>
  )
}

/** Graphics toggles. `inMatch` hides the menu-only switches (menu glow, audio-viz) — irrelevant in a match. */
export function GraphicsControls({ profile, onChange, inMatch = false }: ControlsProps & { inMatch?: boolean }) {
  const t = useT()
  const set = (patch: Partial<PlayerProfile>) => persist(profile, onChange, patch)
  return (
    <>
      <div style={subHeader}>{t.settingsPostproc}</div>
      <ToggleRow checked={profile.postProcessing} onChange={v => set({ postProcessing: v })} label={t.settingsOutlineBlocks} testid="settings-toggle-outline" />
      {!inMatch && <ToggleRow checked={profile.menuGlow} onChange={v => set({ menuGlow: v })} label={t.settingsMenuGlow} testid="settings-toggle-menu-glow" />}
      {!inMatch && <ToggleRow checked={profile.audioViz} onChange={v => set({ audioViz: v })} label={t.settingsAudioViz} testid="settings-toggle-audio-viz" />}
      <div style={subHeader}>{t.settingsOverlayGroup}</div>
      <ToggleRow checked={profile.showFps} onChange={v => set({ showFps: v })} label={t.settingsShowFps} testid="settings-toggle-fps" />
      <ToggleRow checked={profile.showSpeed} onChange={v => set({ showSpeed: v })} label={t.settingsShowSpeed} testid="settings-toggle-speed" />
    </>
  )
}
