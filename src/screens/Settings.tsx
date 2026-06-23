import { useState } from 'react'
import type { CSSProperties } from 'react'
import { NAME_MAX, saveProfile, CONNECT_TIMEOUT_OPTIONS } from '../settings'
import type { PlayerProfile, DefaultView, SearchRole } from '../settings'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { Slider } from '../ui/Slider'
import { RelaysSection } from './RelaysSection'
import { useSfx } from '../sfx/SfxContext'
import { LOCALES, useLocale, useT } from '../i18n'
import { IS_DESKTOP } from '../platform'
import { visibleSections } from './settingsSections'
import type { SettingsSection } from './settingsSections'

export type { SettingsSection }

interface SettingsProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  onBack: () => void
  onWatchTrailer: () => void
  // Active tab — optionally controlled by the parent (to survive a trip into the trailer and back here).
  section?: SettingsSection
  onSectionChange?: (s: SettingsSection) => void
}

type Section = SettingsSection

// Developer links (the "About" section).
const DEV_NAME = 'Shatalov Dmitriy'
const DEV_LINKS: { label: string; href: string }[] = [
  { label: 'YouTube — @watooh', href: 'https://www.youtube.com/@watooh' },
  { label: 'Twitch — dimonplafon', href: 'https://www.twitch.tv/dimonplafon' },
  { label: 'sqarrt1337@gmail.com', href: 'mailto:sqarrt1337@gmail.com' },
]

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }
// Visual group sub-header inside a section (not a tab).
const subHeader: CSSProperties = {
  color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.18em',
  marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-line)',
}

const SECTIONS: Section[] = visibleSections(IS_DESKTOP)
const SEARCH_ROLES: SearchRole[] = ['both', 'client']

/** Number of columns in the language grid (10 languages → 2 rows of 5). */
const LANG_GRID_COLS = 5
/**
 * Compact language-tile style. Grid columns are 1fr (always fit the panel),
 * so we DON'T fix the width; it's critical to reset min-width from .btn (220px), otherwise
 * the buttons overflow their columns and overlap. Padding/letter-spacing/font
 * are tightened so the longest name ("Português (BR)") fits on one line.
 */
const langTile = {
  minWidth: 0,
  margin: 0,
  padding: '0.5rem 0.3rem',
  fontSize: '0.78rem',
  letterSpacing: '0.02em',
  fontWeight: 'bold' as const,
}

export function Settings({ profile, onChange, onBack, onWatchTrailer, section: sectionProp, onSectionChange }: SettingsProps) {
  const sfx = useSfx()
  const t = useT()
  const [locale, setLocale] = useLocale()
  // Controlled by the parent if section/onSectionChange are passed; otherwise — own state.
  const [sectionState, setSectionState] = useState<Section>('player')
  // Clamp away a stale 'net' selection on the Steam build (the tab is hidden there).
  const rawSection = sectionProp ?? sectionState
  const section: Section = (IS_DESKTOP && rawSection === 'net') ? 'player' : rawSection
  const setSection = (s: Section) => { setSectionState(s); onSectionChange?.(s) }
  const [name, setName] = useState(profile.name)
  const [view, setView] = useState<DefaultView>(profile.defaultView)
  const [post, setPost] = useState(profile.postProcessing)
  const [showFps, setShowFps] = useState(profile.showFps)
  const [showSpeed, setShowSpeed] = useState(profile.showSpeed)
  const [menuGlow, setMenuGlow] = useState(profile.menuGlow)
  const [audioViz, setAudioViz] = useState(profile.audioViz)
  const [connTimeout, setConnTimeout] = useState(profile.connectTimeoutSec)
  const [searchRole, setSearchRole] = useState(profile.searchRole)
  const [volMaster, setVolMaster] = useState(profile.volumeMaster)
  const [volMusic, setVolMusic] = useState(profile.volumeMusic)
  const [volSfx, setVolSfx] = useState(profile.volumeSfx)
  const [volMenuMusic, setVolMenuMusic] = useState(profile.volumeMenuMusic)

  // Section labels are taken from the dictionary by id (order — SECTIONS).
  const sectionLabel: Record<Section, string> = {
    player: t.settingsSecPlayer,
    sound: t.settingsSecSound,
    net: t.settingsSecNet,
    graphics: t.settingsSecGraphics,
    about: t.settingsSecAbout,
  }

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  // Non-cosmetic fields — cosmetics now live in the "Appearance" screen and are committed there.
  const base = (): PlayerProfile => ({ ...profile, name, defaultView: view, postProcessing: post, showFps, showSpeed, menuGlow, audioViz, volumeMaster: volMaster, volumeMusic: volMusic, volumeSfx: volSfx, volumeMenuMusic: volMenuMusic, connectTimeoutSec: connTimeout, searchRole })

  // Factory for a simple profile-field handler (no side effects).
  const field = <T,>(setter: (v: T) => void, key: keyof PlayerProfile) =>
    (v: T) => { setter(v); commit({ ...base(), [key]: v } as PlayerProfile) }

  const handleName = (v: string) => {
    const next = v.slice(0, NAME_MAX)
    setName(next)
    commit({ ...base(), name: next })
  }
  const handleView = (v: DefaultView) => {
    if (v !== view) sfx.play2D('ui_toggle')
    setView(v)
    commit({ ...base(), defaultView: v })
  }
  const handleConnTimeout = (v: number) => {
    if (v !== connTimeout) sfx.play2D('ui_toggle')
    setConnTimeout(v)
    commit({ ...base(), connectTimeoutSec: v })
  }
  const handleSearchRole = (r: SearchRole) => {
    if (r !== searchRole) sfx.play2D('ui_toggle')
    setSearchRole(r)
    commit({ ...base(), searchRole: r })
  }
  const handlePost          = field(setPost, 'postProcessing')
  const handleShowFps       = field(setShowFps, 'showFps')
  const handleShowSpeed     = field(setShowSpeed, 'showSpeed')
  const handleMenuGlow      = field(setMenuGlow, 'menuGlow')
  const handleAudioViz      = field(setAudioViz, 'audioViz')
  const handleVolMaster     = field<number>(setVolMaster, 'volumeMaster')
  const handleVolMusic      = field<number>(setVolMusic, 'volumeMusic')
  const handleVolSfx        = field<number>(setVolSfx, 'volumeSfx')
  const handleVolMenuMusic  = field<number>(setVolMenuMusic, 'volumeMenuMusic')

  return (
    // The settings panel doesn't slide right — the shift belongs to the "Appearance" screen.
    // Top-aligned: the title and tabs don't move when switching sections (content has varying height).
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>{t.settingsTitle}</h2>

      {/* Sections */}
      <div style={{ ...row, marginBottom: '1.8rem' }}>
        {SECTIONS.map(id => (
          <button key={id} className={`seg${section === id ? ' seg--on' : ''}`} data-testid={`settings-section-${id}`} onClick={() => { if (id !== section) sfx.play2D('ui_toggle'); setSection(id) }}>
            {sectionLabel[id]}
          </button>
        ))}
      </div>

      {section === 'player' && (
        <>
          <div style={{ marginBottom: '1.6rem' }}>
            <div style={label}>{t.settingsName}</div>
            <input
              className="input"
              value={name}
              onChange={e => handleName(e.target.value)}
              maxLength={NAME_MAX}
              aria-label={t.settingsNameAria}
              data-testid="settings-name-input"
              spellCheck={false}
              autoComplete="off"
              style={{ fontSize: '1.3rem', letterSpacing: '0.1em', padding: '0.5rem 1rem', width: '16rem' }}
            />
          </div>

          <div style={label}>{t.settingsDefaultView}</div>
          <div style={row}>
            {(['fp', 'tp'] as DefaultView[]).map(v => (
              <button key={v} className={`seg${view === v ? ' seg--on' : ''}`} data-testid={`settings-view-${v}`} onClick={() => handleView(v)}>
                {v === 'fp' ? t.settingsViewFp : t.settingsViewTp}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '1.6rem' }}>
            <div style={label} data-testid="settings-language-label">{t.settingsLanguage}</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${LANG_GRID_COLS}, 1fr)`,
              gap: '0.4rem',
            }}>
              {LOCALES.map(l => (
                // always bold — active and inactive look the same, the text doesn't "jump" when toggling
                <Button
                  key={l.id}
                  variant={locale === l.id ? 'primary' : 'secondary'}
                  data-testid={`settings-lang-${l.id}`}
                  onClick={() => setLocale(l.id)}
                  style={langTile}
                >
                  {l.native}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      {section === 'sound' && (
        <>
          <div style={subHeader}>{t.settingsVolumeGroup}</div>
          <Slider label={t.settingsVolMaster} value={volMaster} onChange={handleVolMaster} />
          <Slider label={t.settingsVolMusic} value={volMusic} onChange={handleVolMusic} />
          <Slider label={t.settingsVolMenuMusic} value={volMenuMusic} onChange={handleVolMenuMusic} />
          <Slider label={t.settingsVolSfx} value={volSfx} onChange={handleVolSfx} />
        </>
      )}

      {section === 'net' && (
        <>
          <div style={{ ...label, marginBottom: '0.6rem' }}>{t.settingsSearchRoleLabel}</div>
          <div style={{ ...row, flexWrap: 'wrap' }}>
            {SEARCH_ROLES.map(r => (
              <button key={r} className={`seg${searchRole === r ? ' seg--on' : ''}`} data-testid={`settings-searchrole-${r}`} onClick={() => handleSearchRole(r)}>
                {r === 'both' ? t.settingsSearchRoleBoth : t.settingsSearchRoleClient}
              </button>
            ))}
          </div>
          <div style={{ ...label, marginBottom: '0.6rem' }}>{t.settingsConnTimeout}</div>
          <div style={{ ...row, flexWrap: 'wrap' }}>
            {CONNECT_TIMEOUT_OPTIONS.map(s => (
              <button key={s} className={`seg${connTimeout === s ? ' seg--on' : ''}`} onClick={() => handleConnTimeout(s)}>{t.settingsSeconds(s)}</button>
            ))}
          </div>
          <RelaysSection />
        </>
      )}

      {section === 'graphics' && (
        <>
          <div style={subHeader}>{t.settingsPostproc}</div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={post} onChange={handlePost} aria-label={t.settingsOutlineBlocks} data-testid="settings-toggle-outline" />
            <span style={{ ...label, marginBottom: 0 }}>{t.settingsOutlineBlocks}</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={menuGlow} onChange={handleMenuGlow} aria-label={t.settingsMenuGlow} data-testid="settings-toggle-menu-glow" />
            <span style={{ ...label, marginBottom: 0 }}>{t.settingsMenuGlow}</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={audioViz} onChange={handleAudioViz} aria-label={t.settingsAudioViz} data-testid="settings-toggle-audio-viz" />
            <span style={{ ...label, marginBottom: 0 }}>{t.settingsAudioViz}</span>
          </div>

          <div style={subHeader}>{t.settingsOverlayGroup}</div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={showFps} onChange={handleShowFps} aria-label={t.settingsShowFps} data-testid="settings-toggle-fps" />
            <span style={{ ...label, marginBottom: 0 }}>{t.settingsShowFps}</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={showSpeed} onChange={handleShowSpeed} aria-label={t.settingsShowSpeed} data-testid="settings-toggle-speed" />
            <span style={{ ...label, marginBottom: 0 }}>{t.settingsShowSpeed}</span>
          </div>
        </>
      )}

      {section === 'about' && (
        <>
          <div style={subHeader}>{t.aboutDevGroup}</div>
          <div style={{ color: 'var(--accent-dim)', fontSize: '1.05rem', letterSpacing: '0.08em', marginBottom: '1rem' }}>{DEV_NAME}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.8rem' }}>
            {DEV_LINKS.map(l => (
              <a key={l.href} className="about-link" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
            ))}
          </div>

          <div style={subHeader}>{t.aboutTrailerGroup}</div>
          <Button variant="primary" onClick={onWatchTrailer} data-testid="about-watch-trailer">{t.aboutWatch}</Button>
        </>
      )}

      {/* "BACK" is pinned to the bottom of the panel (marginTop:auto), independent of section height. */}
      <Button variant="ghost" onClick={onBack} data-testid="settings-back" style={{ marginTop: 'auto' }}>{t.settingsBack}</Button>
    </div>
  )
}
