import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { PLAYER_COLORS, BALL_MODELS, WINDUP_STYLES, RESPAWN_STYLES, DASH_STYLES, SHIELD_STYLES } from '../constants'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'
import { saveProfile } from '../settings'
import type { PlayerProfile } from '../settings'
import { Button } from '../ui/Button'
import { BallPaintField } from '../ui/BallPaintField'
import { useSfx } from '../sfx/SfxContext'
import { useT } from '../i18n'
import type { AppearancePart } from '../components/menuStage'
import { decodeBallArt, encodeBallArt, makeEmptyArt, isEmpty, BALL_ART_SIZE } from '../game/ballArt'

interface AppearanceProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  // Live preview (App): color/model/styles + the last clicked block (ball position).
  onPreview: (color: string, model: BallModel, ringColor: string, windupStyle: WindupStyle, respawnStyle: RespawnStyle, dashStyle: DashStyle, shieldStyle: ShieldStyle, part: AppearancePart, ballArt: string | undefined) => void
  // Click on a shot style → one preview run. The counter is owned by App (monotonic,
  // survives screen remount), and the style travels TOGETHER with the trigger — App updates
  // both fields atomically (otherwise the ball starts the preview with the old style and instantly cancels it).
  onShotPreview: (style: WindupStyle) => void
  // Click on a respawn style → one preview run (same atomic scheme, its own counter).
  onRespawnPreview: (style: RespawnStyle) => void
  // Click on a dash-trail skin → one preview run (dash there and back).
  onDashPreview: (style: DashStyle) => void
  // Click on a shield skin → one preview run (shield on for ~1.5s).
  onShieldPreview: (style: ShieldStyle) => void
  onBack: () => void
}

type Slot = 'primary' | 'reserve'

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }

/** "Appearance" screen: all player cosmetics on one screen (no sub-tabs); the preview-ball position
 *  on the left is set by the last clicked block. The panel slides right — animated by App. */
export function Appearance({ profile, onChange, onPreview, onShotPreview, onRespawnPreview, onDashPreview, onShieldPreview, onBack }: AppearanceProps) {
  const sfx = useSfx()
  const t = useT()
  const [part, setPart] = useState<AppearancePart>('color')   // last clicked block → ball position
  const [primary, setPrimary] = useState(profile.primaryColor)
  const [reserve, setReserve] = useState(profile.reserveColor)
  const [model, setModel] = useState<BallModel>(profile.ballModel)
  const [windup, setWindup] = useState<WindupStyle>(profile.windupStyle)
  const [respawn, setRespawn] = useState<RespawnStyle>(profile.respawnStyle)
  const [dash, setDash] = useState<DashStyle>(profile.dashStyle)
  const [shield, setShield] = useState<ShieldStyle>(profile.shieldStyle)
  const [editing, setEditing] = useState<Slot>('primary')   // which color the background model shows
  const [art] = useState(() => decodeBallArt(profile.ballArt) ?? makeEmptyArt())   // artwork (we mutate grids in place)
  const [erasing, setErasing] = useState(false)
  const [artRev, forceArt] = useState(0)   // redraw tick for fields/preview after grid mutation

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  // Non-cosmetic fields — from the CURRENT profile: a commit from "Appearance" doesn't clobber settings edits.
  // ballArt also from profile — other commits (color/model) must not erase the artwork.
  const base = (): PlayerProfile => ({ ...profile, primaryColor: primary, reserveColor: reserve, ballModel: model, windupStyle: windup, respawnStyle: respawn, dashStyle: dash, shieldStyle: shield, ballArt: profile.ballArt })

  // Style-handler factory: sfx on change + preview part change + optional preview callback.
  const styleField = <T,>(
    setter: (v: T) => void,
    key: keyof PlayerProfile,
    partName: AppearancePart,
    prev: T,
    onPreviewCb?: (v: T) => void,
  ) => (v: T) => {
    if (v !== prev) sfx.play2D('ui_toggle')
    setter(v)
    setPart(partName)
    onPreviewCb?.(v)
    commit({ ...base(), [key]: v } as PlayerProfile)
  }

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
  const handleModel   = styleField(setModel,  'ballModel',    'model',   model)
  const handleWindup  = styleField(setWindup,  'windupStyle',  'shot',    windup,  v => onShotPreview(v))
  const handleRespawn = styleField(setRespawn, 'respawnStyle', 'respawn', respawn, v => onRespawnPreview(v))
  const handleDash    = styleField(setDash,    'dashStyle',    'dash',    dash,    v => onDashPreview(v))
  const handleShield  = styleField(setShield,  'shieldStyle',  'shield',  shield,  v => onShieldPreview(v))

  // Artwork: every stroke mutates the grid → re-encodes ballArt into the profile → live preview.
  // An empty artwork is saved as undefined (the field is dropped), a non-empty one — base64.
  const commitArt = () => {
    const encoded = isEmpty(art) ? undefined : encodeBallArt(art)
    forceArt(n => n + 1)
    commit({ ...base(), ballArt: encoded })
  }
  const paintFront = (cx: number, cy: number, v: number) => { setPart('paintFront'); art.front[cy * BALL_ART_SIZE + cx] = v; commitArt() }
  const paintBack = (cx: number, cy: number, v: number) => { setPart('paintBack'); art.back[cy * BALL_ART_SIZE + cx] = v; commitArt() }
  const clearFront = () => { setPart('paintFront'); art.front.fill(0); sfx.play2D('ui_toggle'); commitArt() }
  const clearBack = () => { setPart('paintBack'); art.back.fill(0); sfx.play2D('ui_toggle'); commitArt() }
  const toggleErase = (v: boolean) => { if (v !== erasing) sfx.play2D('ui_toggle'); setErasing(v) }

  const previewColor = editing === 'primary' ? primary : reserve
  const previewRingColor = editing === 'primary' ? reserve : primary   // the "second" color → planet ring
  const modelLabel: Record<BallModel, string> = { smooth: t.styleModelSmooth, waves: t.styleModelWaves, planet: t.styleModelPlanet }
  const windupLabel: Record<WindupStyle, string> = { classic: t.styleWindupClassic, rage: t.styleWindupRage, singularity: t.styleWindupSingularity }
  const respawnLabel: Record<RespawnStyle, string> = { echo: t.styleRespawnEcho, chaos: t.styleRespawnChaos, swarm: t.styleRespawnSwarm }
  const dashLabel: Record<DashStyle, string> = { streak: t.styleDashStreak, wave: t.styleDashWave, rift: t.styleDashRift }
  const shieldLabel: Record<ShieldStyle, string> = { dome: t.styleShieldDome, hex: t.styleShieldHex, crystal: t.styleShieldCrystal }

  // The background model (App) reflects what's being edited live; part moves the ball across block positions.
  // artSig is recomputed on every stroke (forceArt triggers a re-render) → the preview updates the artwork.
  const artSig = isEmpty(art) ? undefined : encodeBallArt(art)
  useEffect(() => { onPreview(previewColor, model, previewRingColor, windup, respawn, dash, shield, part, artSig) }, [previewColor, model, previewRingColor, windup, respawn, dash, shield, part, artSig, onPreview])

  return (
    // The whole panel slides right (animated by App), the background 3D model is on the left.
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh', overflowY: 'auto' }}>
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
          <div key={c} role="button" aria-label={`${t.appearSlotPrimary} ${c}`}
            data-testid={`appearance-primary-${c}`}
            className={`swatch${c === primary ? ' swatch--sel' : ''}`}
            style={{ background: c, color: c }}
            onClick={() => handlePrimary(c)} />
        ))}
      </div>

      <div style={label}>{t.appearReserveColor}</div>
      <div style={row}>
        {PLAYER_COLORS.map(c => (
          <div key={c} role="button" aria-label={`${t.appearSlotReserve} ${c}`}
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

      <div style={label}>{t.appearPaint}</div>
      <div style={{ ...row, gap: '0.4rem' }}>
        <button className={`seg${!erasing ? ' seg--on' : ''}`} data-testid="paint-brush" onClick={() => toggleErase(false)}>{t.appearPaintBrush}</button>
        <button className={`seg${erasing ? ' seg--on' : ''}`} data-testid="paint-eraser" onClick={() => toggleErase(true)}>{t.appearPaintEraser}</button>
      </div>
      <div style={{ ...row, justifyContent: 'space-around' }}>
        <BallPaintField label={t.appearPaintFront} grid={art.front} rev={artRev} erasing={erasing} onPaint={paintFront} onClear={clearFront} clearLabel={t.appearPaintClear} testid="paint-front" />
        <BallPaintField label={t.appearPaintBack} grid={art.back} rev={artRev} erasing={erasing} onPaint={paintBack} onClear={clearBack} clearLabel={t.appearPaintClear} testid="paint-back" />
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

      {/* "BACK" is pinned to the bottom of the panel (marginTop:auto). */}
      <Button variant="ghost" onClick={onBack} data-testid="appearance-back" style={{ marginTop: 'auto' }}>{t.appearBack}</Button>
    </div>
  )
}
