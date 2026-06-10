import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { PLAYER_COLORS, BALL_MODELS, WINDUP_STYLES } from '../constants'
import type { BallModel, WindupStyle } from '../constants'
import { NAME_MAX, saveProfile, CONNECT_TIMEOUT_OPTIONS } from '../settings'
import type { PlayerProfile, DefaultView } from '../settings'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { Slider } from '../ui/Slider'
import { RelaysSection } from './RelaysSection'
import { useSfx } from '../sfx/SfxContext'

interface SettingsProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  onPreview: (color: string, model: BallModel, ringColor: string, windupStyle: WindupStyle) => void   // живое превью (App); ringColor — второй цвет (кольцо)
  onBack: () => void
}

type Slot = 'primary' | 'reserve'
type Section = 'player' | 'sound' | 'net' | 'graphics'

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }
// Визуальный подзаголовок-группа внутри раздела (не вкладка).
const subHeader: CSSProperties = {
  color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.18em',
  marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-line)',
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'player', label: 'ИГРОК' },
  { id: 'sound', label: 'ЗВУК' },
  { id: 'net', label: 'СЕТЬ' },
  { id: 'graphics', label: 'ГРАФИКА' },
]

export function Settings({ profile, onChange, onPreview, onBack }: SettingsProps) {
  const sfx = useSfx()
  const [section, setSection] = useState<Section>('player')
  const [name, setName] = useState(profile.name)
  const [primary, setPrimary] = useState(profile.primaryColor)
  const [reserve, setReserve] = useState(profile.reserveColor)
  const [view, setView] = useState<DefaultView>(profile.defaultView)
  const [model, setModel] = useState<BallModel>(profile.ballModel)
  const [windup, setWindup] = useState<WindupStyle>(profile.windupStyle)
  const [post, setPost] = useState(profile.postProcessing)
  const [showFps, setShowFps] = useState(profile.showFps)
  const [showSpeed, setShowSpeed] = useState(profile.showSpeed)
  const [menuGlow, setMenuGlow] = useState(profile.menuGlow)
  const [audioViz, setAudioViz] = useState(profile.audioViz)
  const [connTimeout, setConnTimeout] = useState(profile.connectTimeoutSec)
  const [volMaster, setVolMaster] = useState(profile.volumeMaster)
  const [volMusic, setVolMusic] = useState(profile.volumeMusic)
  const [volSfx, setVolSfx] = useState(profile.volumeSfx)
  const [volMenuMusic, setVolMenuMusic] = useState(profile.volumeMenuMusic)
  const [editing, setEditing] = useState<Slot>('primary')   // какой цвет показывает фоновая моделька

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  const base = (): PlayerProfile => ({ name, primaryColor: primary, reserveColor: reserve, defaultView: view, ballModel: model, windupStyle: windup, postProcessing: post, showFps, showSpeed, menuGlow, audioViz, volumeMaster: volMaster, volumeMusic: volMusic, volumeSfx: volSfx, volumeMenuMusic: volMenuMusic, connectTimeoutSec: connTimeout })

  const handleName = (v: string) => {
    const next = v.slice(0, NAME_MAX)
    setName(next)
    commit({ ...base(), name: next })
  }
  const handlePrimary = (c: string) => {
    if (c !== primary) sfx.play2D('ui_toggle')
    setEditing('primary')
    setPrimary(c)
    const nextReserve = c === reserve ? (PLAYER_COLORS.find(x => x !== c) ?? reserve) : reserve
    setReserve(nextReserve)
    commit({ ...base(), primaryColor: c, reserveColor: nextReserve })
  }
  const handleReserve = (c: string) => {
    setEditing('reserve')
    if (c === primary) return
    if (c !== reserve) sfx.play2D('ui_toggle')
    setReserve(c)
    commit({ ...base(), primaryColor: primary, reserveColor: c })
  }
  const handleView = (v: DefaultView) => {
    if (v !== view) sfx.play2D('ui_toggle')
    setView(v)
    commit({ ...base(), defaultView: v })
  }
  const handleModel = (m: BallModel) => {
    if (m !== model) sfx.play2D('ui_toggle')
    setModel(m)
    commit({ ...base(), ballModel: m })
  }
  const handleWindup = (w: WindupStyle) => {
    if (w !== windup) sfx.play2D('ui_toggle')
    setWindup(w)
    commit({ ...base(), windupStyle: w })
  }
  const handlePost = (v: boolean) => {
    setPost(v)
    commit({ ...base(), postProcessing: v })
  }
  const handleShowFps = (v: boolean) => {
    setShowFps(v)
    commit({ ...base(), showFps: v })
  }
  const handleShowSpeed = (v: boolean) => {
    setShowSpeed(v)
    commit({ ...base(), showSpeed: v })
  }
  const handleMenuGlow = (v: boolean) => {
    setMenuGlow(v)
    commit({ ...base(), menuGlow: v })
  }
  const handleAudioViz = (v: boolean) => {
    setAudioViz(v)
    commit({ ...base(), audioViz: v })
  }
  const handleConnTimeout = (v: number) => {
    if (v !== connTimeout) sfx.play2D('ui_toggle')
    setConnTimeout(v)
    commit({ ...base(), connectTimeoutSec: v })
  }
  const handleVolMaster = (v: number) => {
    setVolMaster(v)
    commit({ ...base(), volumeMaster: v })
  }
  const handleVolMusic = (v: number) => {
    setVolMusic(v)
    commit({ ...base(), volumeMusic: v })
  }
  const handleVolSfx = (v: number) => {
    setVolSfx(v)
    commit({ ...base(), volumeSfx: v })
  }
  const handleVolMenuMusic = (v: number) => {
    setVolMenuMusic(v)
    commit({ ...base(), volumeMenuMusic: v })
  }

  const previewColor = editing === 'primary' ? primary : reserve
  const previewRingColor = editing === 'primary' ? reserve : primary   // «второй» цвет → кольцо планеты
  const modelLabel: Record<BallModel, string> = { smooth: 'РОВНАЯ', waves: 'ВОЛНЫ', planet: 'ПЛАНЕТА' }
  const windupLabel: Record<WindupStyle, string> = { classic: 'ДЕФОЛТ', rage: 'ЯРОСТЬ', singularity: 'СИНГУЛЯРНОСТЬ' }

  // Фоновая моделька (App) отражает редактируемый цвет/модель вживую.
  useEffect(() => { onPreview(previewColor, model, previewRingColor, windup) }, [previewColor, model, previewRingColor, windup, onPreview])

  return (
    // Подложка целиком уезжает вправо (анимирует App), слева открывается фоновая 3D-моделька.
    // Выравнивание по верху: заголовок и вкладки не двигаются при смене раздела (разная высота контента).
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>НАСТРОЙКИ</h2>

      {/* Разделы */}
      <div style={{ ...row, marginBottom: '1.8rem' }}>
        {SECTIONS.map(s => (
          <button key={s.id} className={`seg${section === s.id ? ' seg--on' : ''}`} onClick={() => { if (s.id !== section) sfx.play2D('ui_toggle'); setSection(s.id) }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'player' && (
        <>
          <div style={{ ...label, marginBottom: '1.8rem' }}>
            НА МОДЕЛИ:{' '}
            <span style={{ color: previewColor, letterSpacing: '0.2em' }}>
              {editing === 'primary' ? 'ОСНОВНОЙ' : 'РЕЗЕРВНЫЙ'}
            </span>
          </div>

          <div style={{ marginBottom: '1.6rem' }}>
            <div style={label}>ИМЯ</div>
            <input
              className="input"
              value={name}
              onChange={e => handleName(e.target.value)}
              maxLength={NAME_MAX}
              aria-label="Имя игрока"
              style={{ fontSize: '1.3rem', letterSpacing: '0.1em', padding: '0.5rem 1rem', width: '16rem' }}
            />
          </div>

          <div style={label}>ОСНОВНОЙ ЦВЕТ</div>
          <div style={row}>
            {PLAYER_COLORS.map(c => (
              <div key={c} role="button" aria-label={`основной ${c}`} title={c}
                className={`swatch${c === primary ? ' swatch--sel' : ''}`}
                style={{ background: c, color: c }}
                onClick={() => handlePrimary(c)} />
            ))}
          </div>

          <div style={label}>РЕЗЕРВНЫЙ ЦВЕТ (когда основной занят)</div>
          <div style={row}>
            {PLAYER_COLORS.map(c => (
              <div key={c} role="button" aria-label={`резервный ${c}`} title={c}
                className={`swatch${c === reserve ? ' swatch--sel' : ''}${c === primary ? ' swatch--dis' : ''}`}
                style={{ background: c, color: c }}
                onClick={() => handleReserve(c)} />
            ))}
          </div>

          <div style={label}>ВИД ПО УМОЛЧАНИЮ</div>
          <div style={row}>
            {(['fp', 'tp'] as DefaultView[]).map(v => (
              <button key={v} className={`seg${view === v ? ' seg--on' : ''}`} onClick={() => handleView(v)}>
                {v === 'fp' ? 'ОТ 1 ЛИЦА' : 'ОТ 3 ЛИЦА'}
              </button>
            ))}
          </div>

          <div style={label}>МОДЕЛЬ СФЕРЫ</div>
          <div style={row}>
            {BALL_MODELS.map(m => (
              <button key={m} className={`seg${model === m ? ' seg--on' : ''}`} onClick={() => handleModel(m)}>
                {modelLabel[m]}
              </button>
            ))}
          </div>

          <div style={label}>АНИМАЦИЯ ВЫСТРЕЛА</div>
          <div style={row}>
            {WINDUP_STYLES.map(w => (
              <button key={w} className={`seg${windup === w ? ' seg--on' : ''}`} onClick={() => handleWindup(w)}>
                {windupLabel[w]}
              </button>
            ))}
          </div>
        </>
      )}

      {section === 'sound' && (
        <>
          <div style={subHeader}>ГРОМКОСТЬ</div>
          <Slider label="ОБЩАЯ ГРОМКОСТЬ" value={volMaster} onChange={handleVolMaster} />
          <Slider label="МУЗЫКА" value={volMusic} onChange={handleVolMusic} />
          <Slider label="МУЗЫКА В МЕНЮ" value={volMenuMusic} onChange={handleVolMenuMusic} />
          <Slider label="ЭФФЕКТЫ" value={volSfx} onChange={handleVolSfx} />
        </>
      )}

      {section === 'net' && (
        <>
          <div style={{ ...label, marginBottom: '0.6rem' }}>ТАЙМАУТ ПОДКЛЮЧЕНИЯ К ЛОББИ</div>
          <div style={{ ...row, flexWrap: 'wrap' }}>
            {CONNECT_TIMEOUT_OPTIONS.map(s => (
              <button key={s} className={`seg${connTimeout === s ? ' seg--on' : ''}`} onClick={() => handleConnTimeout(s)}>{s} С</button>
            ))}
          </div>
          <RelaysSection />
        </>
      )}

      {section === 'graphics' && (
        <>
          <div style={subHeader}>ПОСТПРОЦЕССИНГ</div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={post} onChange={handlePost} aria-label="Подсвечивать контуры блоков" />
            <span style={{ ...label, marginBottom: 0 }}>ПОДСВЕЧИВАТЬ КОНТУРЫ БЛОКОВ</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={menuGlow} onChange={handleMenuGlow} aria-label="Свечение в меню" />
            <span style={{ ...label, marginBottom: 0 }}>СВЕЧЕНИЕ В МЕНЮ</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={audioViz} onChange={handleAudioViz} aria-label="Визуализация звука" />
            <span style={{ ...label, marginBottom: 0 }}>ВИЗУАЛИЗАЦИЯ ЗВУКА</span>
          </div>

          <div style={subHeader}>ОВЕРЛЕЙ</div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={showFps} onChange={handleShowFps} aria-label="Выводить счётчик кадров" />
            <span style={{ ...label, marginBottom: 0 }}>ВЫВОДИТЬ СЧЁТЧИК КАДРОВ</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={showSpeed} onChange={handleShowSpeed} aria-label="Выводить скорость игрока" />
            <span style={{ ...label, marginBottom: 0 }}>ВЫВОДИТЬ СКОРОСТЬ ИГРОКА</span>
          </div>
        </>
      )}

      {/* «НАЗАД» прижата к низу панели (marginTop:auto), не зависит от высоты раздела. */}
      <Button variant="ghost" onClick={onBack} style={{ marginTop: 'auto' }}>НАЗАД</Button>
    </div>
  )
}
