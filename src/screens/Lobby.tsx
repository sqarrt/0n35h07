import { useState, useEffect, type CSSProperties } from 'react'
import type { MapFilter, DurationFilter, MapId } from '../constants'
import { MATCH_DURATIONS_MIN } from '../constants'
import { MAP_IDS, MAP_PREVIEW, MAPS } from '../game/maps'
import { MapPreview } from '../components/MapPreview'
import { generateModelName } from '../names'
import { useT } from '../i18n'
import { useSfx } from '../sfx/SfxContext'

/** Один игрок в слоте лобби. */
export interface LobbySlot { name: string; color: string; ready: boolean }
type OppSlot = LobbySlot & { isBot: boolean }

interface LobbyProps {
  isHost: boolean
  me: LobbySlot
  opponent: OppSlot | null
  mapSel: MapFilter
  durationSel: DurationFilter
  code: string | null
  searching: boolean
  onToggleRole: () => void
  onAddBot: () => void
  onRemoveBot: () => void
  onEnterCode: (code: string) => void
  onSetMap: (m: MapFilter) => void
  onSetDuration: (d: DurationFilter) => void
  onSearch: () => void
  onStopSearch: () => void
  onReady: () => void
  onBack: () => void
  onCopyCode: () => void
}

const NAME_CYCLE_MS = 300
const COPIED_MS = 1500
const mapLabel = (id: MapId) => id.replace('os_', '').toUpperCase()
const pc = (color: string): CSSProperties => ({ ['--pc' as string]: color } as CSSProperties)

export function Lobby(props: LobbyProps) {
  const { isHost, me, opponent, mapSel, durationSel, code, searching } = props
  const t = useT()
  const sfx = useSfx()
  const [entering, setEntering] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [copied, setCopied] = useState(false)

  // Крутящиеся имена в пустом слоте оппонента во время поиска/подключения.
  const [spin, setSpin] = useState('')
  const spinning = searching && !opponent
  useEffect(() => {
    if (!spinning) return
    let name = generateModelName(), dots = 0
    const tick = () => { setSpin(name + '.'.repeat(dots)); dots++; if (dots > 3) { dots = 0; name = generateModelName() } }
    tick()
    const id = setInterval(tick, NAME_CYCLE_MS)
    return () => clearInterval(id)
  }, [spinning])

  const locked = opponent !== null

  const copyCode = () => { props.onCopyCode(); setCopied(true); setTimeout(() => setCopied(false), COPIED_MS) }

  const filledSeat = (slot: LobbySlot, mine: boolean, bot = false) => (
    <div className={`lobby-seat${slot.ready ? ' lobby-seat--ready' : ''}`} style={pc(slot.color)} data-testid={mine ? 'lobby-me' : 'lobby-opponent'}>
      <span className={`lobby-nick${mine ? ' lobby-nick--you' : ''}`}>{slot.name}</span>
      {bot && <button className="lobby-rmbot" data-testid="lobby-removebot" onClick={() => { sfx.play2D('ui_toggle'); props.onRemoveBot() }}>{t.roomRemoveBot}</button>}
    </div>
  )

  const emptyOpponentSeat = () => {
    if (spinning) return <div className="lobby-seat"><span className="lobby-nick lobby-nick--searching" data-testid="lobby-spin">{spin}</span></div>
    return (
      <div className="lobby-split">
        <button className="lobby-half lobby-half--take" data-testid="lobby-become" onClick={() => { sfx.play2D('ui_toggle'); props.onToggleRole() }}>
          <span className="lobby-half-ic">⇄</span>
          <span className="lobby-half-txt">{isHost ? t.lobbyBecomeClient : t.lobbyBecomeHost}</span>
        </button>
        {isHost ? (
          <button className="lobby-half lobby-half--alt" data-testid="lobby-addbot" onClick={() => { sfx.play2D('ui_toggle'); props.onAddBot() }}>
            <span className="lobby-half-ic">＋</span>
            <span className="lobby-half-txt">{t.lobbyBot}</span>
          </button>
        ) : (
          <button className="lobby-half lobby-half--alt" data-testid="lobby-entercode" onClick={() => setEntering(true)}>
            <span className="lobby-half-ic">⌨</span>
            <span className="lobby-half-txt">{t.lobbyEnterCode}</span>
          </button>
        )}
      </div>
    )
  }

  const meSeat = filledSeat(me, true)
  const oppSeat = opponent ? filledSeat(opponent, false, opponent.isBot) : emptyOpponentSeat()
  const left = isHost ? meSeat : oppSeat
  const right = isHost ? oppSeat : meSeat

  const submitCode = () => { const c = codeInput.trim().toUpperCase(); if (c) props.onEnterCode(c) }

  const mapTile = (id: MapId) => (
    <button key={id} className={`map-tile${mapSel === id ? ' map-tile--on' : ''}`} data-testid={`lobby-map-${id}`} aria-pressed={mapSel === id} onClick={() => { if (mapSel !== id) sfx.play2D('ui_toggle'); props.onSetMap(id) }}>
      {MAP_PREVIEW[id] ? <img className="map-preview" src={MAP_PREVIEW[id]} alt={mapLabel(id)} /> : <MapPreview map={MAPS[id]} />}
      <span className="map-tile-label">{mapLabel(id)}</span>
    </button>
  )

  return (
    <div className="panel-fill" style={{ justifyContent: 'center' }}>
      <div className="lobby">
        <div className="lobby-title">{t.menuPlay}</div>

        {/* код под заголовком: хост — свой код; клиент — поле (по «Ввести код»); место зарезервировано */}
        <div className="lobby-code">
          {copied ? (
            <span className="lobby-copied" data-testid="lobby-copied">{t.roomCopied}</span>
          ) : isHost && code ? (
            <button className="lobby-code-btn" data-testid="lobby-code" onClick={copyCode} title={t.roomCopyTooltip}>
              <span className="lobby-code-val">{code}</span>
              <span className="lobby-code-glyph" aria-hidden="true">⧉</span>
            </button>
          ) : !isHost && entering ? (
            <input
              className="lobby-code-input" data-testid="lobby-code-input" autoFocus
              placeholder={t.lobbyCodePlaceholder} value={codeInput} maxLength={4}
              onChange={e => setCodeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCode() }}
              onBlur={() => { if (!codeInput) setEntering(false) }}
            />
          ) : null}
        </div>

        <div className="lobby-seats">
          {left}
          <span className="lobby-vs">VS</span>
          {right}
        </div>

        <div className={`lobby-opts${locked ? ' lobby-opts--locked' : ''}`}>
          <div className="lobby-ogrp">
            <span className="lobby-ol">// {t.lobbyMap}</span>
            <div className="lobby-maptiles">
              {MAP_IDS.map(mapTile)}
              <button className={`map-tile map-tile--any${mapSel === 'any' ? ' map-tile--on' : ''}`} data-testid="lobby-map-any" aria-pressed={mapSel === 'any'} onClick={() => { if (mapSel !== 'any') sfx.play2D('ui_toggle'); props.onSetMap('any') }}>
                <span className="map-preview map-preview--any">✱</span>
                <span className="map-tile-label">{t.lobbyAny}</span>
              </button>
            </div>
          </div>
          <div className="lobby-ogrp">
            <span className="lobby-ol">// {t.lobbyTime}</span>
            <div className="lobby-segs">
              {MATCH_DURATIONS_MIN.map(m => (
                <button key={m} className={`seg${durationSel === m ? ' seg--on' : ''}`} data-testid={`lobby-time-${m}`} onClick={() => { if (durationSel !== m) sfx.play2D('ui_toggle'); props.onSetDuration(m) }}>{m}</button>
              ))}
              <button className={`seg seg--any${durationSel === 'any' ? ' seg--on' : ''}`} data-testid="lobby-time-any" onClick={() => { if (durationSel !== 'any') sfx.play2D('ui_toggle'); props.onSetDuration('any') }}>{t.lobbyAny}</button>
            </div>
          </div>
        </div>

        {/* нижнее действие: соперник найден → ГОТОВ; поиск → та же кнопка становится СТОП; иначе → ПОИСК */}
        {opponent ? (
          <button className="lobby-hero lobby-hero--go" data-testid="lobby-ready" onClick={() => { sfx.play2D('ready'); props.onReady() }}>✓ {t.lobbyReady}</button>
        ) : searching ? (
          <button className="lobby-hero lobby-hero--searching" data-testid="lobby-stop" onClick={props.onStopSearch}>⏹ {t.lobbyStop}</button>
        ) : (
          <button className="lobby-hero" data-testid="lobby-search" onClick={() => { sfx.play2D('ui_toggle'); props.onSearch() }}>⌕ {t.lobbySearch}</button>
        )}

        <button className="lobby-back" data-testid="lobby-back" onClick={props.onBack}>{opponent ? t.lobbyLeave : t.roomBack}</button>
      </div>
    </div>
  )
}
