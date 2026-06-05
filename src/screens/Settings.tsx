import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { PLAYER_COLORS, BALL_MODELS } from '../constants'
import type { BallModel } from '../constants'
import { NAME_MAX, saveProfile } from '../settings'
import type { PlayerProfile, DefaultView } from '../settings'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { RelaysSection } from './RelaysSection'

interface SettingsProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  onPreview: (color: string, model: BallModel) => void   // живое превью для фоновой модельки (App)
  onBack: () => void
}

type Slot = 'primary' | 'reserve'
type Section = 'player' | 'net' | 'graphics'

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }
// Визуальный подзаголовок-группа внутри раздела (не вкладка).
const subHeader: CSSProperties = {
  color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.18em',
  marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-line)',
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'player', label: 'ИГРОК' },
  { id: 'net', label: 'СЕТЬ' },
  { id: 'graphics', label: 'ГРАФИКА' },
]

export function Settings({ profile, onChange, onPreview, onBack }: SettingsProps) {
  const [section, setSection] = useState<Section>('player')
  const [name, setName] = useState(profile.name)
  const [primary, setPrimary] = useState(profile.primaryColor)
  const [reserve, setReserve] = useState(profile.reserveColor)
  const [view, setView] = useState<DefaultView>(profile.defaultView)
  const [model, setModel] = useState<BallModel>(profile.ballModel)
  const [post, setPost] = useState(profile.postProcessing)
  const [showFps, setShowFps] = useState(profile.showFps)
  const [showSpeed, setShowSpeed] = useState(profile.showSpeed)
  const [editing, setEditing] = useState<Slot>('primary')   // какой цвет показывает фоновая моделька

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  const base = (): PlayerProfile => ({ name, primaryColor: primary, reserveColor: reserve, defaultView: view, ballModel: model, postProcessing: post, showFps, showSpeed })

  const handleName = (v: string) => {
    const next = v.slice(0, NAME_MAX)
    setName(next)
    commit({ ...base(), name: next })
  }
  const handlePrimary = (c: string) => {
    setEditing('primary')
    setPrimary(c)
    const nextReserve = c === reserve ? (PLAYER_COLORS.find(x => x !== c) ?? reserve) : reserve
    setReserve(nextReserve)
    commit({ ...base(), primaryColor: c, reserveColor: nextReserve })
  }
  const handleReserve = (c: string) => {
    setEditing('reserve')
    if (c === primary) return
    setReserve(c)
    commit({ ...base(), primaryColor: primary, reserveColor: c })
  }
  const handleView = (v: DefaultView) => {
    setView(v)
    commit({ ...base(), defaultView: v })
  }
  const handleModel = (m: BallModel) => {
    setModel(m)
    commit({ ...base(), ballModel: m })
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

  const previewColor = editing === 'primary' ? primary : reserve
  const modelLabel: Record<BallModel, string> = { smooth: 'РОВНАЯ', waves: 'ВОЛНЫ', planet: 'ПЛАНЕТА' }

  // Фоновая моделька (App) отражает редактируемый цвет/модель вживую.
  useEffect(() => { onPreview(previewColor, model) }, [previewColor, model, onPreview])

  return (
    // Подложка целиком уезжает вправо (анимирует App), слева открывается фоновая 3D-моделька.
    // Выравнивание по верху: заголовок и вкладки не двигаются при смене раздела (разная высота контента).
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>НАСТРОЙКИ</h2>

      {/* Разделы */}
      <div style={{ ...row, marginBottom: '1.8rem' }}>
        {SECTIONS.map(s => (
          <button key={s.id} className={`seg${section === s.id ? ' seg--on' : ''}`} onClick={() => setSection(s.id)}>
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
        </>
      )}

      {section === 'net' && <RelaysSection />}

      {section === 'graphics' && (
        <>
          <div style={subHeader}>ПОСТПРОЦЕССИНГ</div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={post} onChange={handlePost} aria-label="Подсвечивать контуры" />
            <span style={{ ...label, marginBottom: 0 }}>ПОДСВЕЧИВАТЬ КОНТУРЫ</span>
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
