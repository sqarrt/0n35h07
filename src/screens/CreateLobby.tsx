import type { CSSProperties } from 'react'
import type { BotDifficulty } from '../constants'
export type { BotDifficulty }
import { btn, dimBtn, screenOverlay } from './styles'

interface CreateLobbyProps {
  lobbyCode: string
  botCount: number
  botDifficulty: BotDifficulty
  onBotCountChange: (n: number) => void
  onDifficultyChange: (d: BotDifficulty) => void
  onStart: () => void
  onBack: () => void
}

export function CreateLobby({
  lobbyCode, botCount, botDifficulty,
  onBotCountChange, onDifficultyChange, onStart, onBack,
}: CreateLobbyProps) {
  const diffBtn = (d: BotDifficulty): CSSProperties => ({
    ...btn,
    minWidth: 'auto',
    padding: '0.5rem 1.2rem',
    background: botDifficulty === d ? 'rgba(68,170,255,0.15)' : 'transparent',
    borderColor: botDifficulty === d ? '#4af' : '#334',
    color: botDifficulty === d ? '#4af' : '#556',
  })

  return (
    <div style={screenOverlay}>
      <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '2rem', marginTop: 0 }}>
        СОЗДАТЬ ЛОББИ
      </h2>

      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
          КОД ЛОББИ
        </div>
        <div style={{ fontSize: '2rem', letterSpacing: '0.5em', color: '#ccd', fontWeight: 'bold' }}>
          {lobbyCode}
        </div>
      </div>

      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.8rem' }}>
          КОЛИЧЕСТВО БОТОВ
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button
            style={{ ...btn, minWidth: 'auto', padding: '0.5rem 1.2rem', fontSize: '1.4rem' }}
            onClick={() => onBotCountChange(Math.max(1, botCount - 1))}
          >−</button>
          <span style={{ fontSize: '2rem', minWidth: '2rem', textAlign: 'center', color: '#4af' }}>
            {botCount}
          </span>
          <button
            style={{ ...btn, minWidth: 'auto', padding: '0.5rem 1.2rem', fontSize: '1.4rem' }}
            onClick={() => onBotCountChange(Math.min(4, botCount + 1))}
          >+</button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.8rem' }}>
          СЛОЖНОСТЬ
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={diffBtn('normal')} onClick={() => onDifficultyChange('normal')}>
            НОРМАЛЬНЫЙ
          </button>
          <button style={diffBtn('passive')} onClick={() => onDifficultyChange('passive')}>
            ПАССИВНЫЙ
          </button>
        </div>
      </div>

      <button style={btn} onClick={onStart}>НАЧАТЬ ИГРУ</button>
      <button style={dimBtn} onClick={onBack}>НАЗАД</button>
    </div>
  )
}
