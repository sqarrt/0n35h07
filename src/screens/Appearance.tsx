import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { PLAYER_COLORS, BALL_MODELS, WINDUP_STYLES, RESPAWN_STYLES, DASH_STYLES, SHIELD_STYLES } from '../constants'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'
import { saveProfile } from '../settings'
import type { PlayerProfile } from '../settings'
import { Button } from '../ui/Button'
import { useSfx } from '../sfx/SfxContext'
import { useT } from '../i18n'
import type { AppearancePart } from '../components/menuStage'

interface AppearanceProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  // Живое превью (App): цвет/модель/стили + последний кликнутый блок (позиция шара).
  onPreview: (color: string, model: BallModel, ringColor: string, windupStyle: WindupStyle, respawnStyle: RespawnStyle, dashStyle: DashStyle, shieldStyle: ShieldStyle, part: AppearancePart) => void
  // Клик по стилю выстрела → один прогон превью. Счётчиком владеет App (монотонный,
  // переживает перемонтирование экрана), а стиль едет ВМЕСТЕ с триггером — App обновляет
  // оба поля атомарно (иначе шар запускает превью со старым стилем и тут же гасит его).
  onShotPreview: (style: WindupStyle) => void
  // Клик по стилю респавна → один прогон превью (та же атомарная схема, свой счётчик).
  onRespawnPreview: (style: RespawnStyle) => void
  // Клик по скину следа рывка → один прогон превью (рывок туда-обратно).
  onDashPreview: (style: DashStyle) => void
  // Клик по скину щита → один прогон превью (включение щита на ~1.5с).
  onShieldPreview: (style: ShieldStyle) => void
  onBack: () => void
}

type Slot = 'primary' | 'reserve'

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }

/** Экран «Внешность»: вся косметика игрока на одном экране (без подвкладок); позиция шара-превью
 *  слева определяется последним кликнутым блоком. Панель уезжает вправо — анимирует App. */
export function Appearance({ profile, onChange, onPreview, onShotPreview, onRespawnPreview, onDashPreview, onShieldPreview, onBack }: AppearanceProps) {
  const sfx = useSfx()
  const t = useT()
  const [part, setPart] = useState<AppearancePart>('color')   // последний кликнутый блок → позиция шара
  const [primary, setPrimary] = useState(profile.primaryColor)
  const [reserve, setReserve] = useState(profile.reserveColor)
  const [model, setModel] = useState<BallModel>(profile.ballModel)
  const [windup, setWindup] = useState<WindupStyle>(profile.windupStyle)
  const [respawn, setRespawn] = useState<RespawnStyle>(profile.respawnStyle)
  const [dash, setDash] = useState<DashStyle>(profile.dashStyle)
  const [shield, setShield] = useState<ShieldStyle>(profile.shieldStyle)
  const [editing, setEditing] = useState<Slot>('primary')   // какой цвет показывает фоновая моделька

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  // Не-косметические поля — из АКТУАЛЬНОГО профиля: коммит из «Внешности» не затирает правки настроек.
  const base = (): PlayerProfile => ({ ...profile, primaryColor: primary, reserveColor: reserve, ballModel: model, windupStyle: windup, respawnStyle: respawn, dashStyle: dash, shieldStyle: shield })

  const handlePrimary = (c: string) => {
    if (c !== primary) sfx.play2D('ui_toggle')
    setEditing('primary')
    setPart('color')
    setPrimary(c)
    const nextReserve = c === reserve ? (PLAYER_COLORS.find(x => x !== c) ?? reserve) : reserve
    setReserve(nextReserve)
    commit({ ...base(), primaryColor: c, reserveColor: nextReserve })
  }
  const handleReserve = (c: string) => {
    setEditing('reserve')
    setPart('color')
    if (c === primary) return
    if (c !== reserve) sfx.play2D('ui_toggle')
    setReserve(c)
    commit({ ...base(), primaryColor: primary, reserveColor: c })
  }
  const handleModel = (m: BallModel) => {
    if (m !== model) sfx.play2D('ui_toggle')
    setModel(m)
    setPart('model')
    commit({ ...base(), ballModel: m })
  }
  const handleWindup = (w: WindupStyle) => {
    if (w !== windup) sfx.play2D('ui_toggle')
    setWindup(w)
    setPart('shot')
    onShotPreview(w)   // всегда (даже клик по тому же стилю) — один прогон превью выстрела
    commit({ ...base(), windupStyle: w })
  }
  const handleRespawn = (r: RespawnStyle) => {
    if (r !== respawn) sfx.play2D('ui_toggle')
    setRespawn(r)
    setPart('respawn')
    onRespawnPreview(r)   // всегда — один прогон превью респавна
    commit({ ...base(), respawnStyle: r })
  }
  const handleDash = (d: DashStyle) => {
    if (d !== dash) sfx.play2D('ui_toggle')
    setDash(d)
    setPart('dash')
    onDashPreview(d)   // всегда — один прогон превью рывка (туда-обратно)
    commit({ ...base(), dashStyle: d })
  }
  const handleShield = (s: ShieldStyle) => {
    if (s !== shield) sfx.play2D('ui_toggle')
    setShield(s)
    setPart('shield')
    onShieldPreview(s)   // всегда — один прогон превью щита
    commit({ ...base(), shieldStyle: s })
  }

  const previewColor = editing === 'primary' ? primary : reserve
  const previewRingColor = editing === 'primary' ? reserve : primary   // «второй» цвет → кольцо планеты
  const modelLabel: Record<BallModel, string> = { smooth: t.styleModelSmooth, waves: t.styleModelWaves, planet: t.styleModelPlanet }
  const windupLabel: Record<WindupStyle, string> = { classic: t.styleWindupClassic, rage: t.styleWindupRage, singularity: t.styleWindupSingularity }
  const respawnLabel: Record<RespawnStyle, string> = { echo: t.styleRespawnEcho, chaos: t.styleRespawnChaos, swarm: t.styleRespawnSwarm }
  const dashLabel: Record<DashStyle, string> = { streak: t.styleDashStreak, wave: t.styleDashWave, rift: t.styleDashRift }
  const shieldLabel: Record<ShieldStyle, string> = { dome: t.styleShieldDome, hex: t.styleShieldHex, crystal: t.styleShieldCrystal }

  // Фоновая моделька (App) отражает редактируемое вживую; part двигает шар по позициям блоков.
  useEffect(() => { onPreview(previewColor, model, previewRingColor, windup, respawn, dash, shield, part) }, [previewColor, model, previewRingColor, windup, respawn, dash, shield, part, onPreview])

  return (
    // Подложка целиком уезжает вправо (анимирует App), слева — фоновая 3D-моделька.
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>{t.appearTitle}</h2>

      <div style={{ ...label, marginBottom: '1.8rem' }}>
        {t.appearOnModel}{' '}
        <span style={{ color: previewColor, letterSpacing: '0.2em' }}>
          {editing === 'primary' ? t.appearSlotPrimary : t.appearSlotReserve}
        </span>
      </div>

      <div style={label}>{t.appearPrimaryColor}</div>
      <div style={row}>
        {PLAYER_COLORS.map(c => (
          <div key={c} role="button" aria-label={`${t.appearSlotPrimary} ${c}`} title={c}
            data-testid={`appearance-primary-${c}`}
            className={`swatch${c === primary ? ' swatch--sel' : ''}`}
            style={{ background: c, color: c }}
            onClick={() => handlePrimary(c)} />
        ))}
      </div>

      <div style={label}>{t.appearReserveColor}</div>
      <div style={row}>
        {PLAYER_COLORS.map(c => (
          <div key={c} role="button" aria-label={`${t.appearSlotReserve} ${c}`} title={c}
            data-testid={`appearance-reserve-${c}`}
            className={`swatch${c === reserve ? ' swatch--sel' : ''}${c === primary ? ' swatch--dis' : ''}`}
            style={{ background: c, color: c }}
            onClick={() => handleReserve(c)} />
        ))}
      </div>

      <div style={label}>{t.appearModel}</div>
      <div style={row}>
        {BALL_MODELS.map(m => (
          <button key={m} className={`seg${model === m ? ' seg--on' : ''}`} data-testid={`appearance-model-${m}`} onClick={() => handleModel(m)}>
            {modelLabel[m]}
          </button>
        ))}
      </div>

      <div style={label}>{t.appearShotAnim}</div>
      <div style={row}>
        {WINDUP_STYLES.map(w => (
          <button key={w} className={`seg${windup === w ? ' seg--on' : ''}`} data-testid={`appearance-windup-${w}`} onClick={() => handleWindup(w)}>
            {windupLabel[w]}
          </button>
        ))}
      </div>

      <div style={label}>{t.appearRespawnAnim}</div>
      <div style={row}>
        {RESPAWN_STYLES.map(r => (
          <button key={r} className={`seg${respawn === r ? ' seg--on' : ''}`} data-testid={`appearance-respawn-${r}`} onClick={() => handleRespawn(r)}>
            {respawnLabel[r]}
          </button>
        ))}
      </div>

      <div style={label}>{t.appearDashTrail}</div>
      <div style={row}>
        {DASH_STYLES.map(d => (
          <button key={d} className={`seg${dash === d ? ' seg--on' : ''}`} data-testid={`appearance-dash-${d}`} onClick={() => handleDash(d)}>
            {dashLabel[d]}
          </button>
        ))}
      </div>

      <div style={label}>{t.appearShield}</div>
      <div style={row}>
        {SHIELD_STYLES.map(s => (
          <button key={s} className={`seg${shield === s ? ' seg--on' : ''}`} data-testid={`appearance-shield-${s}`} onClick={() => handleShield(s)}>
            {shieldLabel[s]}
          </button>
        ))}
      </div>

      {/* «НАЗАД» прижата к низу панели (marginTop:auto). */}
      <Button variant="ghost" onClick={onBack} data-testid="appearance-back" style={{ marginTop: 'auto' }}>{t.appearBack}</Button>
    </div>
  )
}
