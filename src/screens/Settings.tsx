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

export type SettingsSection = 'player' | 'sound' | 'net' | 'graphics' | 'about'

interface SettingsProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  onBack: () => void
  onWatchTrailer: () => void
  // Активная вкладка — опционально управляемая родителем (чтобы пережить заход в трейлер и вернуться сюда же).
  section?: SettingsSection
  onSectionChange?: (s: SettingsSection) => void
}

type Section = SettingsSection

// Ссылки разработчика (раздел «Об игре»).
const DEV_NAME = 'Shatalov Dmitriy'
const DEV_LINKS: { label: string; href: string }[] = [
  { label: 'YouTube — @watooh', href: 'https://www.youtube.com/@watooh' },
  { label: 'Twitch — dimonplafon', href: 'https://www.twitch.tv/dimonplafon' },
  { label: 'sqarrt1337@gmail.com', href: 'mailto:sqarrt1337@gmail.com' },
]

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }
// Визуальный подзаголовок-группа внутри раздела (не вкладка).
const subHeader: CSSProperties = {
  color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.18em',
  marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-line)',
}

const SECTIONS: Section[] = ['player', 'sound', 'net', 'graphics', 'about']
const SEARCH_ROLES: SearchRole[] = ['both', 'client']

/** Число колонок в сетке языков (10 языков → 2 ряда по 5). */
const LANG_GRID_COLS = 5
/**
 * Компактный стиль плитки языка. Колонки сетки — 1fr (всегда вмещаются в панель),
 * поэтому ширину НЕ фиксируем; критично сбросить min-width от .btn (220px), иначе
 * кнопки вылезают за свои колонки и наезжают друг на друга. Padding/letter-spacing/шрифт
 * ужаты, чтобы самое длинное название («Português (BR)») влезало в строку.
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
  // Управляемо родителем, если переданы section/onSectionChange; иначе — собственное состояние.
  const [sectionState, setSectionState] = useState<Section>('player')
  const section = sectionProp ?? sectionState
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

  // Подписи разделов берём из словаря по id (порядок — SECTIONS).
  const sectionLabel: Record<Section, string> = {
    player: t.settingsSecPlayer,
    sound: t.settingsSecSound,
    net: t.settingsSecNet,
    graphics: t.settingsSecGraphics,
    about: t.settingsSecAbout,
  }

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  // Не-косметические поля — косметика теперь живёт в экране «Внешность» и коммитится там.
  const base = (): PlayerProfile => ({ ...profile, name, defaultView: view, postProcessing: post, showFps, showSpeed, menuGlow, audioViz, volumeMaster: volMaster, volumeMusic: volMusic, volumeSfx: volSfx, volumeMenuMusic: volMenuMusic, connectTimeoutSec: connTimeout, searchRole })

  // Фабрика простого обработчика поля профиля (без побочных эффектов).
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
    // Панель настроек не уезжает вправо — сдвиг принадлежит экрану «Внешность».
    // Выравнивание по верху: заголовок и вкладки не двигаются при смене раздела (разная высота контента).
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>{t.settingsTitle}</h2>

      {/* Разделы */}
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
                // bold всегда — активная и неактивная одинаковые, текст не «прыгает» при переключении
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

      {/* «НАЗАД» прижата к низу панели (marginTop:auto), не зависит от высоты раздела. */}
      <Button variant="ghost" onClick={onBack} data-testid="settings-back" style={{ marginTop: 'auto' }}>{t.settingsBack}</Button>
    </div>
  )
}
