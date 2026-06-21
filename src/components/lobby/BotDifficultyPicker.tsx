import { type CSSProperties } from 'react'
import type { BotDifficulty } from '../../constants'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'

const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }
const DIFFICULTIES: BotDifficulty[] = ['normal', 'passive']

interface BotDifficultyPickerProps {
  difficulty: BotDifficulty
  onSetDifficulty: (d: BotDifficulty) => void
}

/** "With bot" mode block: difficulty selection for the already-added bot. */
export function BotDifficultyPicker({ difficulty, onSetDifficulty }: BotDifficultyPickerProps) {
  const t = useT()
  const sfx = useSfx()
  const diffLabel: Record<BotDifficulty, string> = { normal: t.roomDiffNormal, passive: t.roomDiffPassive }
  const pick = (d: BotDifficulty) => { if (d === difficulty) return; sfx.play2D('ui_toggle'); onSetDifficulty(d) }
  return (
    <div className="lobby-bot">
      <div style={LABEL}>{t.lobbyBot}</div>
      <div className="lobby-segs">
        {DIFFICULTIES.map(d => (
          <button key={d} className={`seg${difficulty === d ? ' seg--on' : ''}`} data-testid={`lobby-bot-diff-${d}`} onClick={() => pick(d)}>{diffLabel[d]}</button>
        ))}
      </div>
    </div>
  )
}
