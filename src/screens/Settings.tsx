import { useState } from 'react'
import type { CSSProperties } from 'react'
import { PLAYER_COLORS, BALL_MODELS } from '../constants'
import type { BallModel } from '../constants'
import { NAME_MAX, saveProfile } from '../settings'
import type { PlayerProfile, DefaultView } from '../settings'
import { BallPreview } from '../components/BallPreview'
import { dimBtn, screenOverlay } from './styles'

interface SettingsProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  onBack: () => void
}

type Slot = 'primary' | 'reserve'

const swatch = (color: string, selected: boolean, disabled: boolean): CSSProperties => ({
  width: 34, height: 34, borderRadius: '50%', background: color,
  border: selected ? '3px solid #ccd' : '2px solid #223',
  opacity: disabled ? 0.25 : 1,
  cursor: disabled ? 'default' : 'pointer',
  boxShadow: selected ? `0 0 10px ${color}` : 'none',
})

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }

const segBtn = (active: boolean): CSSProperties => ({
  background: active ? 'rgba(68,170,255,0.12)' : 'transparent',
  border: `1px solid ${active ? '#4af' : '#334'}`,
  color: active ? '#4af' : '#667',
  padding: '0.45rem 0.9rem',
  fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.1em',
  cursor: 'pointer',
})

export function Settings({ profile, onChange, onBack }: SettingsProps) {
  const [name, setName] = useState(profile.name)
  const [primary, setPrimary] = useState(profile.primaryColor)
  const [reserve, setReserve] = useState(profile.reserveColor)
  const [view, setView] = useState<DefaultView>(profile.defaultView)
  const [model, setModel] = useState<BallModel>(profile.ballModel)
  const [editing, setEditing] = useState<Slot>('primary')   // какой цвет показывает превью

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  const base = () => ({ name, primaryColor: primary, reserveColor: reserve, defaultView: view, ballModel: model })

  const handleName = (v: string) => {
    const next = v.slice(0, NAME_MAX)
    setName(next)
    commit({ ...base(), name: next })
  }
  const handlePrimary = (c: string) => {
    setEditing('primary')
    setPrimary(c)
    // Резерв не может совпасть с основным — сдвигаем на первый отличный.
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

  const previewColor = editing === 'primary' ? primary : reserve
  const modelLabel: Record<BallModel, string> = { smooth: 'РОВНАЯ', waves: 'ВОЛНЫ', planet: 'ПЛАНЕТА' }

  return (
    <div style={screenOverlay}>
      <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '2rem', marginTop: 0 }}>НАСТРОЙКИ</h2>

      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start' }}>
        {/* Левая панель — живое превью шара в редактируемом цвете */}
        <div style={{ textAlign: 'center' }}>
          <BallPreview color={previewColor} model={model} />
          <div style={{ ...label, marginTop: '0.9rem', marginBottom: 0, color: previewColor, letterSpacing: '0.2em' }}>
            {editing === 'primary' ? 'ОСНОВНОЙ' : 'РЕЗЕРВНЫЙ'}
          </div>
        </div>

        {/* Правая панель — имя и палитры */}
        <div>
          <div style={{ marginBottom: '1.6rem' }}>
            <div style={label}>ИМЯ</div>
            <input
              value={name}
              onChange={e => handleName(e.target.value)}
              maxLength={NAME_MAX}
              aria-label="Имя игрока"
              style={{
                background: 'transparent', border: '1px solid #4af', color: '#ccd',
                fontFamily: 'monospace', fontSize: '1.3rem', letterSpacing: '0.1em',
                padding: '0.5rem 1rem', width: '16rem', outline: 'none',
              }}
            />
          </div>

          <div style={label}>ОСНОВНОЙ ЦВЕТ</div>
          <div style={row}>
            {PLAYER_COLORS.map(c => (
              <div key={c} role="button" aria-label={`основной ${c}`} title={c}
                style={swatch(c, c === primary, false)} onClick={() => handlePrimary(c)} />
            ))}
          </div>

          <div style={label}>РЕЗЕРВНЫЙ ЦВЕТ (когда основной занят)</div>
          <div style={row}>
            {PLAYER_COLORS.map(c => (
              <div key={c} role="button" aria-label={`резервный ${c}`} title={c}
                style={swatch(c, c === reserve, c === primary)}
                onClick={() => handleReserve(c)} />
            ))}
          </div>

          <div style={label}>ВИД ПО УМОЛЧАНИЮ</div>
          <div style={row}>
            {(['fp', 'tp'] as DefaultView[]).map(v => (
              <button key={v} style={segBtn(view === v)} onClick={() => handleView(v)}>
                {v === 'fp' ? 'ОТ 1 ЛИЦА' : 'ОТ 3 ЛИЦА'}
              </button>
            ))}
          </div>

          <div style={label}>МОДЕЛЬ СФЕРЫ</div>
          <div style={row}>
            {BALL_MODELS.map(m => (
              <button key={m} style={segBtn(model === m)} onClick={() => handleModel(m)}>
                {modelLabel[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button style={dimBtn} onClick={onBack}>НАЗАД</button>
    </div>
  )
}
