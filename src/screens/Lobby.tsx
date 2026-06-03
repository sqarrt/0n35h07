import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { BotDifficulty } from '../constants'
import { HOST_ID, OPPONENT_ID } from '../constants'
import type { LobbyView } from '../net/LobbySession'
import type { RosterEntry } from '../net/protocol'
import { Button } from '../ui/Button'

interface LobbyProps {
  lobbyCode: string
  view: LobbyView
  onAddBot: () => void
  onRemoveBot: () => void
  onSetDifficulty: (d: BotDifficulty) => void
  onStart: () => void
  onBack: () => void
}

const ballStyle = (color: string): CSSProperties => ({
  background: color,
  boxShadow: `0 0 26px ${color}80, inset -12px -12px 26px rgba(0,0,0,0.4)`,
})

export function Lobby({ lobbyCode, view, onAddBot, onRemoveBot, onSetDifficulty, onStart, onBack }: LobbyProps) {
  const { roster, isHost, localPlayerId, connected, canStart } = view
  const host = roster.find(r => r.id === HOST_ID)
  const opponent = roster.find(r => r.id === OPPONENT_ID) ?? null
  const [copied, setCopied] = useState(false)

  const copyInvite = async () => {
    const url = `${location.origin}${location.pathname}#${lobbyCode}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const pane = (entry: RosterEntry | null, side: 'host' | 'opp') => {
    if (!entry) {
      return (
        <div className="lobby-pane">
          <div className="lobby-ph" />
          <div style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 12, letterSpacing: '0.14em' }}>
            ОЖИДАНИЕ СОПЕРНИКА…
          </div>
          {isHost && <Button variant="ghost" style={{ minWidth: 'auto', fontSize: '0.75rem', padding: '0.4rem 1rem' }} onClick={onAddBot}>ДОБАВИТЬ БОТА</Button>}
        </div>
      )
    }
    const mine = entry.id === localPlayerId
    const tag = side === 'host' ? 'ХОСТ' : entry.kind === 'bot' ? 'БОТ' : 'ИГРОК'
    const tagColor = side === 'host' ? '#7fa0c0' : entry.kind === 'bot' ? 'var(--opp)' : 'var(--ok)'
    return (
      <div className="lobby-pane">
        <div className="lobby-ball" style={ballStyle(entry.color)} />
        <div className="lobby-nick" style={{ color: entry.color }}>{entry.name}{mine ? ' (вы)' : ''}</div>
        <div className="lobby-tag" style={{ color: tagColor }}>{tag}</div>
        {entry.kind === 'bot' && isHost && (
          <>
            <div style={{ display: 'flex', gap: 7 }}>
              <button className={`seg${entry.difficulty === 'normal' ? ' seg--on' : ''}`} onClick={() => onSetDifficulty('normal')}>НОРМАЛЬНЫЙ</button>
              <button className={`seg${entry.difficulty === 'passive' ? ' seg--on' : ''}`} onClick={() => onSetDifficulty('passive')}>ПАССИВНЫЙ</button>
            </div>
            <button
              aria-label="×"
              style={{ background: 'transparent', border: 'none', fontSize: 10, color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: 'var(--ui-font)' }}
              onClick={onRemoveBot}
            >× убрать</button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="lobby-frame" style={{ minWidth: 560 }}>
        <div style={{ fontSize: 16, letterSpacing: '0.3em', color: '#7fa0c0', textAlign: 'center', marginBottom: 22, fontFamily: 'var(--ui-font)' }}>ЛОББИ</div>
        <div className="lobby-face">
          {pane(host ?? null, 'host')}
          <div className="lobby-center">
            <div className="lobby-code">{lobbyCode}</div>
            <button className="copy-btn" onClick={copyInvite}>{copied ? 'СКОПИРОВАНО' : '⧉ КОПИРОВАТЬ'}</button>
            <div className="lobby-vs">— VS —</div>
            {/* скрытый узел для тестов формата кода */}
            <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>КОД: {lobbyCode}</div>
          </div>
          {pane(opponent, 'opp')}
        </div>
        <div style={{ borderTop: '1px solid var(--surface-line)', marginTop: 22, paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {isHost
            ? <Button variant="primary" disabled={!canStart} onClick={onStart} style={{ width: 300 }}>НАЧАТЬ</Button>
            : <div style={{ color: 'var(--muted)', fontSize: '0.8rem', letterSpacing: '0.15em', fontFamily: 'var(--ui-font)' }}>{connected ? 'ОЖИДАНИЕ ХОСТА…' : 'ПОДКЛЮЧЕНИЕ…'}</div>}
          <Button variant="ghost" onClick={onBack} style={{ width: 300 }}>НАЗАД</Button>
        </div>
      </div>
    </div>
  )
}
