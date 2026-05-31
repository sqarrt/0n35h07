import type { CSSProperties } from 'react'
import type { BotDifficulty } from '../constants'
import { HOST_ID, OPPONENT_ID } from '../constants'
import type { LobbyView } from '../net/LobbySession'
import type { RosterEntry } from '../net/protocol'
import { btn, dimBtn, screenOverlay } from './styles'

interface LobbyProps {
  lobbyCode: string
  view: LobbyView
  onAddBot: () => void
  onRemoveBot: () => void
  onSetDifficulty: (d: BotDifficulty) => void
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

const rowBase: CSSProperties = {
  padding: '0.5rem 1rem',
  borderBottom: '1px solid #1a2030',
  color: '#778', fontSize: '0.9rem',
  display: 'flex', alignItems: 'center', gap: '0.5rem',
}

export function Lobby({ lobbyCode, view, onAddBot, onRemoveBot, onSetDifficulty, onStart, onBack }: LobbyProps) {
  const { roster, isHost, localPlayerId, connected, canStart } = view
  const host = roster.find(r => r.id === HOST_ID)
  const opponent = roster.find(r => r.id === OPPONENT_ID) ?? null

  const diffBtn = (cur: BotDifficulty | undefined, d: BotDifficulty): CSSProperties => ({
    ...smallBtn,
    borderColor: cur === d ? '#4af' : '#334',
    color: cur === d ? '#4af' : '#556',
    background: cur === d ? 'rgba(68,170,255,0.1)' : 'transparent',
  })

  const row = (entry: RosterEntry) => (
    <div key={entry.id} style={rowBase}>
      <span style={{ color: entry.color, fontSize: '0.7rem' }}>●</span>
      <span style={{ flex: 1, color: entry.id === localPlayerId ? '#ccd' : '#778' }}>
        {entry.name}{entry.id === localPlayerId ? ' (вы)' : ''}
      </span>
      {entry.kind === 'bot' && isHost && (
        <>
          <button style={diffBtn(entry.difficulty, 'normal')} onClick={() => onSetDifficulty('normal')}>НОРМАЛЬНЫЙ</button>
          <button style={diffBtn(entry.difficulty, 'passive')} onClick={() => onSetDifficulty('passive')}>ПАССИВНЫЙ</button>
          <button style={{ ...smallBtn, color: '#445', borderColor: '#2a2030' }} onClick={onRemoveBot}>×</button>
        </>
      )}
      {entry.kind === 'human' && entry.id !== localPlayerId && (
        <span style={{ color: '#4fa', fontSize: '0.6rem', letterSpacing: '0.1em' }}>ИГРОК</span>
      )}
    </div>
  )

  return (
    <div style={screenOverlay}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#4af', letterSpacing: '0.2em', margin: 0 }}>ЛОББИ</h2>
        <span style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em' }}>КОД: {lobbyCode}</span>
      </div>

      <div style={{ marginBottom: '0.5rem', minWidth: '380px' }}>
        {host && row(host)}
        {opponent
          ? row(opponent)
          : (
            <div style={{ ...rowBase, color: '#556', fontStyle: 'italic' }}>
              <span style={{ color: '#445', fontSize: '0.7rem' }}>○</span>
              <span style={{ flex: 1 }}>ОЖИДАНИЕ СОПЕРНИКА…</span>
            </div>
          )}
      </div>

      {isHost && !opponent && (
        <button
          style={{ ...dimBtn, minWidth: 'auto', padding: '0.4rem 1.2rem', fontSize: '0.8rem', marginBottom: '1.5rem' }}
          onClick={onAddBot}
        >
          ДОБАВИТЬ БОТА
        </button>
      )}

      {isHost
        ? <button
            style={{ ...btn, opacity: canStart ? 1 : 0.4, cursor: canStart ? 'pointer' : 'default' }}
            disabled={!canStart}
            onClick={onStart}
          >
            НАЧАТЬ
          </button>
        : <div style={{ color: '#556', fontSize: '0.8rem', letterSpacing: '0.15em', marginBottom: '0.8rem' }}>
            {connected ? 'ОЖИДАНИЕ ХОСТА…' : 'ПОДКЛЮЧЕНИЕ…'}
          </div>
      }
      <button style={dimBtn} onClick={onBack}>НАЗАД</button>
    </div>
  )
}
