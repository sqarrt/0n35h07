import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { PLAYER_COLORS, BALL_MODELS, WINDUP_STYLES } from '../constants'
import type { BallModel, WindupStyle } from '../constants'
import { saveProfile } from '../settings'
import type { PlayerProfile } from '../settings'
import { Button } from '../ui/Button'
import { useSfx } from '../sfx/SfxContext'
import type { AppearancePart } from '../components/menuBallTargets'

interface AppearanceProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  // Живое превью (App): цвет/модель/стиль + активная подвкладка (позиция шара).
  onPreview: (color: string, model: BallModel, ringColor: string, windupStyle: WindupStyle, part: AppearancePart) => void
  // Клик по стилю выстрела → один прогон превью. Счётчиком владеет App (монотонный,
  // переживает перемонтирование экрана) — иначе при повторном заходе счёт с нуля
  // рассинхронизировался с шаром (призрачный запуск + «мёртвый» первый клик).
  onShotPreview: () => void
  onBack: () => void
}

type Slot = 'primary' | 'reserve'

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }

const PARTS: { id: AppearancePart; label: string }[] = [
  { id: 'color', label: 'ЦВЕТ' },
  { id: 'model', label: 'МОДЕЛЬ' },
  { id: 'shot', label: 'ВЫСТРЕЛ' },
]

/** Экран «Внешность»: косметика игрока (цвета/модель/анимация выстрела) с шаром-превью слева
 *  (панель уезжает вправо — анимирует App). Контролы перенесены из Settings 1-в-1. */
export function Appearance({ profile, onChange, onPreview, onShotPreview, onBack }: AppearanceProps) {
  const sfx = useSfx()
  const [part, setPart] = useState<AppearancePart>('color')
  const [primary, setPrimary] = useState(profile.primaryColor)
  const [reserve, setReserve] = useState(profile.reserveColor)
  const [model, setModel] = useState<BallModel>(profile.ballModel)
  const [windup, setWindup] = useState<WindupStyle>(profile.windupStyle)
  const [editing, setEditing] = useState<Slot>('primary')   // какой цвет показывает фоновая моделька

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  // Не-косметические поля — из АКТУАЛЬНОГО профиля: коммит из «Внешности» не затирает правки настроек.
  const base = (): PlayerProfile => ({ ...profile, primaryColor: primary, reserveColor: reserve, ballModel: model, windupStyle: windup })

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
  const handleModel = (m: BallModel) => {
    if (m !== model) sfx.play2D('ui_toggle')
    setModel(m)
    commit({ ...base(), ballModel: m })
  }
  const handleWindup = (w: WindupStyle) => {
    if (w !== windup) sfx.play2D('ui_toggle')
    setWindup(w)
    onShotPreview()   // всегда (даже клик по тому же стилю) — один прогон превью выстрела
    commit({ ...base(), windupStyle: w })
  }

  const previewColor = editing === 'primary' ? primary : reserve
  const previewRingColor = editing === 'primary' ? reserve : primary   // «второй» цвет → кольцо планеты
  const modelLabel: Record<BallModel, string> = { smooth: 'РОВНАЯ', waves: 'ВОЛНЫ', planet: 'ПЛАНЕТА' }
  const windupLabel: Record<WindupStyle, string> = { classic: 'ДЕФОЛТ', rage: 'ЯРОСТЬ', singularity: 'СИНГУЛЯРНОСТЬ' }

  // Фоновая моделька (App) отражает редактируемое вживую; part двигает шар по позициям подвкладок.
  useEffect(() => { onPreview(previewColor, model, previewRingColor, windup, part) }, [previewColor, model, previewRingColor, windup, part, onPreview])

  return (
    // Подложка целиком уезжает вправо (анимирует App), слева — фоновая 3D-моделька.
    // Выравнивание по верху: заголовок и вкладки не двигаются при смене подраздела.
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>ВНЕШНОСТЬ</h2>

      {/* Подвкладки */}
      <div style={{ ...row, marginBottom: '1.8rem' }}>
        {PARTS.map(p => (
          <button key={p.id} className={`seg${part === p.id ? ' seg--on' : ''}`} onClick={() => { if (p.id !== part) sfx.play2D('ui_toggle'); setPart(p.id) }}>
            {p.label}
          </button>
        ))}
      </div>

      {part === 'color' && (
        <>
          <div style={{ ...label, marginBottom: '1.8rem' }}>
            НА МОДЕЛИ:{' '}
            <span style={{ color: previewColor, letterSpacing: '0.2em' }}>
              {editing === 'primary' ? 'ОСНОВНОЙ' : 'РЕЗЕРВНЫЙ'}
            </span>
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
        </>
      )}

      {part === 'model' && (
        <>
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

      {part === 'shot' && (
        <>
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

      {/* «НАЗАД» прижата к низу панели (marginTop:auto), не зависит от высоты подраздела. */}
      <Button variant="ghost" onClick={onBack} style={{ marginTop: 'auto' }}>НАЗАД</Button>
    </div>
  )
}
