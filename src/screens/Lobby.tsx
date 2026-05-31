import type { CSSProperties } from 'react'
import type { BotDifficulty } from '../constants'
import { btn, dimBtn, screenOverlay } from './styles'

interface LobbyProps {
  lobbyCode: string
  botDifficulties: BotDifficulty[]
  onBotAdd: () => void
  onBotRemove: (idx: number) => void
  onDifficultyChange: (idx: number, d: BotDifficulty) => void
  onStart: () => void
  onBack: () => void
}

const smallBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid #334',
  color: '#556',
  padding: '0.25rem 0.6rem',
  fontFamily: 'monospace',
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  cursor: 'pointer',
}

export function Lobby({ lobbyCode, botDifficulties, onBotAdd, onBotRemove, onDifficultyChange, onStart, onBack }: LobbyProps) {
  const botCount = botDifficulties.length
  const totalPlayers = botCount

  const diffBtn = (idx: number, d: BotDifficulty): CSSProperties => ({
    ...smallBtn,
    borderColor: botDifficulties[idx] === d ? '#4af' : '#334',
    color: botDifficulties[idx] === d ? '#4af' : '#556',
    background: botDifficulties[idx] === d ? 'rgba(68,170,255,0.1)' : 'transparent',
  })

  return (
    <div style={screenOverlay}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#4af', letterSpacing: '0.2em', margin: 0 }}>ЛОББИ</h2>
        <span style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em' }}>КОД: {lobbyCode}</span>
      </div>

      <div style={{ color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>
        ИГРОКОВ: {totalPlayers}
      </div>

      <div style={{ marginBottom: '0.5rem', minWidth: '360px' }}>
        {botDifficulties.map((_, i) => (
          <div key={i} style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid #1a2030',
            color: '#778', fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span style={{ color: '#445', fontSize: '0.6rem' }}>●</span>
            <span style={{ flex: 1 }}>Бот {i + 1}</span>
            <button style={diffBtn(i, 'normal')} onClick={() => onDifficultyChange(i, 'normal')}>
              НОРМАЛЬНЫЙ
            </button>
            <button style={diffBtn(i, 'passive')} onClick={() => onDifficultyChange(i, 'passive')}>
              ПАССИВНЫЙ
            </button>
            <button
              style={{ ...smallBtn, color: '#445', borderColor: '#2a2030' }}
              onClick={() => onBotRemove(i)}
            >×</button>
          </div>
        ))}
      </div>

      {botCount < 4 && (
        <button
          style={{ ...dimBtn, minWidth: 'auto', padding: '0.4rem 1.2rem', fontSize: '0.8rem', marginBottom: '1.5rem' }}
          onClick={onBotAdd}
        >
          ДОБАВИТЬ БОТА
        </button>
      )}

      {botCount >= 4
        ? <div style={{ color: '#f44', fontSize: '0.8rem', letterSpacing: '0.15em', marginBottom: '0.8rem' }}>
            ЛОББИ ЗАПОЛНЕНО
          </div>
        : <button style={btn} onClick={onStart}>ВОЙТИ</button>
      }
      <button style={dimBtn} onClick={onBack}>НАЗАД</button>
    </div>
  )
}
