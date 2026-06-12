import { useState, useEffect, useRef } from 'react'
import type { BotDifficulty, MapId } from '../constants'
import { HOST_ID, OPPONENT_ID, MATCH_DURATIONS_MIN } from '../constants'
import { MAPS, MAP_IDS, MAP_PREVIEW } from '../game/maps'
import type { RoomView } from '../net/RoomSession'
import type { RosterEntry } from '../net/protocol'
import { Button } from '../ui/Button'
import { MapPreview } from '../components/MapPreview'
import { useSfx } from '../sfx/SfxContext'
import { useT } from '../i18n'

interface RoomProps {
  roomCode: string
  view: RoomView
  onAddBot: () => void
  onRemoveBot: () => void
  onSetDifficulty: (d: BotDifficulty) => void
  onSetDuration: (min: number) => void
  onSetMap: (id: MapId) => void
  onStart: () => void
  onBack: () => void
}


export function Room({ roomCode, view, onAddBot, onRemoveBot, onSetDifficulty, onSetDuration, onSetMap, onStart, onBack }: RoomProps) {
  const { roster, isHost, localPlayerId, connected, canStart, durationMin, mapId } = view
  const host = roster.find(r => r.id === HOST_ID)
  const opponent = roster.find(r => r.id === OPPONENT_ID) ?? null
  const [copied, setCopied] = useState(false)
  const sfx = useSfx()
  const t = useT()

  // Звук появления соперника в слоте (переход «пусто → занято»).
  const hadOpponent = useRef(false)
  useEffect(() => {
    const has = opponent !== null
    if (has && !hadOpponent.current) sfx.play2D('room_join')
    hadOpponent.current = has
  }, [opponent, sfx])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = roomCode; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const pane = (entry: RosterEntry | null, side: 'host' | 'opp') => {
    if (!entry) {
      return (
        <div className="room-pane">
          <div style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 12, letterSpacing: '0.14em' }}>
            {t.roomWaitingOpponent}
          </div>
          {isHost && <Button data-testid="room-add-bot" variant="ghost" style={{ minWidth: 'auto', fontSize: '0.75rem', padding: '0.4rem 1rem' }} onClick={onAddBot}>{t.roomAddBot}</Button>}
        </div>
      )
    }
    const mine = entry.id === localPlayerId
    const tag = side === 'host' ? t.roomTagHost : entry.kind === 'bot' ? t.roomTagBot : t.roomTagPlayer
    const tagColor = side === 'host' ? '#7fa0c0' : entry.kind === 'bot' ? 'var(--opp)' : 'var(--ok)'
    return (
      <div className="room-pane">
        <div className="room-nick" style={{ color: entry.color, textDecoration: mine ? 'underline' : undefined, textUnderlineOffset: 4 }}>{entry.kind === 'bot' ? t.botName : entry.name}</div>
        <div className="room-tag" style={{ color: tagColor }}>{tag}</div>
        {entry.kind === 'bot' && isHost && (
          <>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button data-testid="room-difficulty-normal" className={`seg${entry.difficulty === 'normal' ? ' seg--on' : ''}`} onClick={() => { if (entry.difficulty !== 'normal') sfx.play2D('ui_toggle'); onSetDifficulty('normal') }}>{t.roomDiffNormal}</button>
              <button data-testid="room-difficulty-passive" className={`seg${entry.difficulty === 'passive' ? ' seg--on' : ''}`} onClick={() => { if (entry.difficulty !== 'passive') sfx.play2D('ui_toggle'); onSetDifficulty('passive') }}>{t.roomDiffPassive}</button>
            </div>
            <button
              data-testid="room-remove-bot"
              aria-label="×"
              style={{ background: 'transparent', border: 'none', fontSize: 10, color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: 'var(--ui-font)' }}
              onClick={onRemoveBot}
            >{t.roomRemoveBot}</button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="panel-fill" style={{ justifyContent: 'center' }}>
      {/* textIndent = letterSpacing: компенсирует хвостовой интервал последней буквы при центрировании. */}
      <div data-testid="room-title" style={{ fontSize: 16, letterSpacing: '0.3em', textIndent: '0.3em', color: '#7fa0c0', textAlign: 'center', marginBottom: 22, fontFamily: 'var(--ui-font)' }}>{t.roomTitle}</div>
        <div className="room-face">
          {pane(host ?? null, 'host')}
          <div className="room-center">
            {/* подпись центрируется по колонке (=по заголовку комнаты), а не по кнопке код+глиф (её центр смещён) */}
            {copied && <span className="room-copied">{t.roomCopied}</span>}
            <button className="room-code-copy" onClick={copyCode} title={t.roomCopyTooltip}>
              <span data-testid="room-code" className="room-code">{roomCode}</span>
              <span className="glyph" aria-hidden="true">⧉</span>
            </button>
            <div className="room-vs">— VS —</div>
          </div>
          {pane(opponent, 'opp')}
        </div>
        <div style={{ borderTop: '1px solid var(--surface-line)', marginTop: 16, paddingTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)' }}>{t.roomSectionMap}</div>
          {/* Плитки с 3D-превью: клик по плитке выбирает карту (только хост; клиент видит выбор). */}
          <div className="map-tiles">
            {MAP_IDS.map(id => (
              <button
                key={id}
                data-testid={`room-map-${id}`}
                className={`map-tile${mapId === id ? ' map-tile--on' : ''}`}
                style={{ cursor: isHost ? 'pointer' : 'default' }}
                aria-pressed={mapId === id}
                onClick={isHost ? () => { if (mapId !== id) sfx.play2D('ui_toggle'); onSetMap(id) } : undefined}
              >
                {/* Готовый рендер (preview.png) — мгновенно; фолбэк — живой превью-канвас. */}
                {MAP_PREVIEW[id]
                  ? <img className="map-preview" src={MAP_PREVIEW[id]} alt={t.roomMapAlt(id)} />
                  : <MapPreview map={MAPS[id]} />}
                <span className="map-tile-label">{id}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--surface-line)', marginTop: 16, paddingTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)' }}>{t.roomSectionDuration}</div>
          {isHost ? (
            <div style={{ display: 'flex', gap: 9 }}>
              {MATCH_DURATIONS_MIN.map(m => (
                <button key={m} data-testid={`room-duration-${m}`} className={`seg${durationMin === m ? ' seg--on' : ''}`} onClick={() => { if (durationMin !== m) sfx.play2D('ui_toggle'); onSetDuration(m) }}>{t.roomDurationMin(m)}</button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 14, letterSpacing: '0.14em', color: '#9fb4c8', border: '1px solid var(--surface-line)', padding: '6px 16px' }}>{t.roomDurationMin(durationMin)}</div>
          )}
        </div>
        <div style={{ borderTop: '1px solid var(--surface-line)', marginTop: 22, paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {isHost
            ? <Button data-testid="room-start" variant="primary" disabled={!canStart} onClick={onStart} style={{ width: 300 }}>{t.roomStart}</Button>
            : <div data-testid="room-waiting" style={{ color: 'var(--muted)', fontSize: '0.8rem', letterSpacing: '0.15em', fontFamily: 'var(--ui-font)' }}>{connected ? t.roomWaitingHost : t.roomConnecting}</div>}
          <Button data-testid="room-back" variant="ghost" onClick={onBack} style={{ width: 300 }}>{t.roomBack}</Button>
        </div>
    </div>
  )
}
