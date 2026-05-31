import type { CSSProperties } from 'react'
import type { BotDifficulty } from '../constants'
import { MAX_PLAYERS } from '../constants'
import type { LobbyView } from '../net/LobbySession'
import { btn, dimBtn, screenOverlay } from './styles'

interface LobbyProps {
  lobbyCode: string
  view: LobbyView
  onAddBot: () => void
  onRemoveBot: (id: number) => void
  onSetDifficulty: (id: number, d: BotDifficulty) => void
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

export function Lobby({ lobbyCode, view, onAddBot, onRemoveBot, onSetDifficulty, onStart, onBack }: LobbyProps) {
  const { roster, isHost, localPlayerId, connected } = view
  const full = roster.length >= MAX_PLAYERS

  const diffBtn = (cur: BotDifficulty | undefined, d: BotDifficulty): CSSProperties => ({
    ...smallBtn,
    borderColor: cur === d ? '#4af' : '#334',
    color: cur === d ? '#4af' : '#556',
    background: cur === d ? 'rgba(68,170,255,0.1)' : 'transparent',
  })

  return (
    <div style={screenOverlay}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#4af', letterSpacing: '0.2em', margin: 0 }}>ЛОББИ</h2>
        <span style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em' }}>КОД: {lobbyCode}</span>
      </div>

      <div style={{ color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>
        ИГРОКОВ: {roster.length}
      </div>

      <div style={{ marginBottom: '0.5rem', minWidth: '380px' }}>
        {roster.map(e => (
          <div key={e.id} style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid #1a2030',
            color: '#778', fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span style={{ color: e.color, fontSize: '0.7rem' }}>●</span>
            <span style={{ flex: 1, color: e.id === localPlayerId ? '#ccd' : '#778' }}>
              {e.name}{e.id === localPlayerId ? ' (вы)' : ''}
            </span>
            {e.kind === 'bot' && isHost && (
              <>
                <button style={diffBtn(e.difficulty, 'normal')} onClick={() => onSetDifficulty(e.id, 'normal')}>НОРМАЛЬНЫЙ</button>
                <button style={diffBtn(e.difficulty, 'passive')} onClick={() => onSetDifficulty(e.id, 'passive')}>ПАССИВНЫЙ</button>
                <button style={{ ...smallBtn, color: '#445', borderColor: '#2a2030' }} onClick={() => onRemoveBot(e.id)}>×</button>
              </>
            )}
            {e.kind === 'human' && e.id !== localPlayerId && (
              <span style={{ color: '#4fa', fontSize: '0.6rem', letterSpacing: '0.1em' }}>ИГРОК</span>
            )}
          </div>
        ))}
      </div>

      {isHost && !full && (
        <button
          style={{ ...dimBtn, minWidth: 'auto', padding: '0.4rem 1.2rem', fontSize: '0.8rem', marginBottom: '1.5rem' }}
          onClick={onAddBot}
        >
          ДОБАВИТЬ БОТА
        </button>
      )}
      {isHost && full && (
        <div style={{ color: '#f44', fontSize: '0.8rem', letterSpacing: '0.15em', marginBottom: '0.8rem' }}>
          ЛОББИ ЗАПОЛНЕНО
        </div>
      )}

      {isHost
        ? <button style={btn} onClick={onStart}>НАЧАТЬ</button>
        : <div style={{ color: '#556', fontSize: '0.8rem', letterSpacing: '0.15em', marginBottom: '0.8rem' }}>
            {connected ? 'ОЖИДАНИЕ ХОСТА…' : 'ПОДКЛЮЧЕНИЕ…'}
          </div>
      }
      <button style={dimBtn} onClick={onBack}>НАЗАД</button>
    </div>
  )
}
