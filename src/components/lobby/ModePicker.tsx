import { type CSSProperties } from 'react'
import { GAME_MODES, type GameMode } from '../../game/modes'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'

const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }

interface ModePickerProps {
  mode: GameMode
  enabled: boolean   // only the host switches the preset (and not mid-search)
  onSetMode: (m: GameMode) => void
}

/** Lobby preset picker: 1v1 / 2v2 / FFA. The mode fixes seats, teams and the spawn rule. */
export function ModePicker({ mode, enabled, onSetMode }: ModePickerProps) {
  const t = useT()
  const sfx = useSfx()
  const label: Record<GameMode, string> = { '1v1': t.lobbyMode1v1, '2v2': t.lobbyMode2v2, ffa: t.lobbyModeFfa }
  const pick = (m: GameMode) => { if (m === mode || !enabled) return; sfx.play2D('ui_toggle'); onSetMode(m) }
  return (
    <div className="lobby-bot">
      <div style={LABEL}>{t.lobbyMode}</div>
      <div className="lobby-segs">
        {GAME_MODES.map(m => (
          <button key={m} className={`seg${mode === m ? ' seg--on' : ''}`} data-testid={`lobby-mode-${m}`}
            disabled={!enabled} onClick={() => pick(m)}>{label[m]}</button>
        ))}
      </div>
    </div>
  )
}
