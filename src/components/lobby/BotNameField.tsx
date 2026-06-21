import { type CSSProperties } from 'react'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import { generateModelName } from '../../names'
import { NAME_MAX } from '../../settings'

const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }
const INPUT: CSSProperties = { fontSize: '1.1rem', letterSpacing: '0.12em', padding: '0.4rem 0.9rem', width: '12rem', textAlign: 'center' }

interface BotNameFieldProps {
  name: string
  onSetName: (name: string) => void
}

/** Bot name field on the "With bot" tab: the name sets personality + appearance. 🎲 — random name; empty = random on add. */
export function BotNameField({ name, onSetName }: BotNameFieldProps) {
  const t = useT()
  const sfx = useSfx()
  const roll = () => { sfx.play2D('ui_toggle'); onSetName(generateModelName()) }
  return (
    <div className="lobby-code">
      <div style={LABEL}>{t.lobbyBotName}</div>
      <div className="lobby-code-row">
        <input
          className="input" data-testid="lobby-bot-name"
          value={name} maxLength={NAME_MAX}
          placeholder={t.lobbyBotNamePlaceholder}
          onChange={e => onSetName(e.target.value)}
          style={INPUT}
        />
        <button className="lobby-copy-btn" data-testid="lobby-bot-name-random" title={t.lobbyBotNameRandom} onClick={roll}>🎲</button>
      </div>
    </div>
  )
}
