import { useState, type CSSProperties } from 'react'
import type { BotDifficulty } from '../../constants'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'

const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }
const DIFFICULTIES: BotDifficulty[] = ['normal', 'passive']

interface BotPickerProps {
  disabled: boolean            // у клиента — весь раздел задизейблен (ботом управляет только хост)
  slotTaken: boolean           // слот соперника занят (бот/человек) → нельзя ДОБАВИТЬ
  hasBot: boolean              // в слоте бот → можно УБРАТЬ
  onAdd: (d: BotDifficulty) => void
  onRemove: () => void
  onSetDifficulty: (d: BotDifficulty) => void
}

/** Подраздел «БОТ»: выбор сложности + кнопки ДОБАВИТЬ/УБРАТЬ. У клиента весь блок задизейблен. */
export function BotPicker({ disabled, slotTaken, hasBot, onAdd, onRemove, onSetDifficulty }: BotPickerProps) {
  const t = useT()
  const sfx = useSfx()
  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal')
  const diffLabel: Record<BotDifficulty, string> = { normal: t.roomDiffNormal, passive: t.roomDiffPassive }

  const pick = (d: BotDifficulty) => { if (d === difficulty) return; sfx.play2D('ui_toggle'); setDifficulty(d); onSetDifficulty(d) }

  return (
    <div className="lobby-bot">
      <div style={LABEL}>{t.lobbyBot}</div>
      <div className="lobby-segs">
        {DIFFICULTIES.map(d => (
          <button key={d} className={`seg${difficulty === d ? ' seg--on' : ''}`} data-testid={`lobby-bot-diff-${d}`} disabled={disabled} onClick={() => pick(d)}>{diffLabel[d]}</button>
        ))}
      </div>
      <div className="lobby-segs lobby-bot-actions">
        <button className="seg" data-testid="lobby-bot-add" disabled={disabled || slotTaken} onClick={() => { sfx.play2D('ui_toggle'); onAdd(difficulty) }}>{t.lobbyBotAdd}</button>
        <button className="seg" data-testid="lobby-bot-remove" disabled={disabled || !hasBot} onClick={() => { sfx.play2D('ui_toggle'); onRemove() }}>{t.lobbyBotRemove}</button>
      </div>
    </div>
  )
}
