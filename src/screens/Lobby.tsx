import { useState, useEffect, type CSSProperties } from 'react'
import type { MapFilter, DurationFilter, MapId } from '../constants'
import { MATCH_DURATIONS_MIN } from '../constants'
import { MAP_IDS, MAP_PREVIEW } from '../game/maps'
import { generateModelName } from '../names'
import { useT } from '../i18n'
import { useSfx } from '../sfx/SfxContext'

/** Один игрок в слоте лобби (имя/цвет/готовность). */
export interface LobbySlot { name: string; color: string; ready: boolean }

interface LobbyProps {
  isHost: boolean                 // ты хост (левый слот) или клиент (правый)
  me: LobbySlot
  opponent: LobbySlot | null      // null = слот пуст (idle/поиск)
  mapSel: MapFilter
  durationSel: DurationFilter
  code: string | null             // твой код (если ты хост) — иначе null
  searching: boolean
  onToggleRole: () => void        // «Стать хостом/клиентом»
  onAddBot: () => void
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
const mapLabel = (id: MapId) => id.replace('os_', '').toUpperCase()
const pc = (color: string): CSSProperties => ({ ['--pc' as string]: color } as CSSProperties)

export function Lobby(props: LobbyProps) {
  const { isHost, me, opponent, mapSel, durationSel, code, searching } = props
  const t = useT()
  const sfx = useSfx()
  const [entering, setEntering] = useState(false)
  const [codeInput, setCodeInput] = useState('')

  // Крутящиеся имена в пустом слоте оппонента во время поиска (RX-700 → RX-700. → … → новое имя).
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

  const locked = opponent !== null   // соперник найден → опции зафиксированы

  const seat = (slot: LobbySlot, mine: boolean) => (
    <div className={`lobby-seat${slot.ready ? ' lobby-seat--ready' : ''}`} style={pc(slot.color)} data-testid={mine ? 'lobby-me' : 'lobby-opponent'}>
      <span className={`lobby-nick${mine ? ' lobby-nick--you' : ''}`}>{slot.name}</span>
    </div>
  )

  const emptyOpponentSeat = () => {
    if (spinning) return <div className="lobby-seat"><span className="lobby-nick lobby-nick--searching" data-testid="lobby-spin">{spin}</span></div>
    // idle: сплит «Стать <ролью>» + действие (хост: бот; клиент: ввести код хоста)
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

  const meSeat = seat(me, true)
  const oppSeat = opponent ? seat(opponent, false) : emptyOpponentSeat()
  const left = isHost ? meSeat : oppSeat
  const right = isHost ? oppSeat : meSeat

  const submitCode = () => { const c = codeInput.trim().toUpperCase(); if (c) props.onEnterCode(c) }

  return (
    <div className="panel-fill" style={{ justifyContent: 'center' }}>
      <div className="lobby">
        <div className="lobby-title">{t.menuPlay}</div>

        {/* код под заголовком: хост — свой код; клиент — поле (по «Ввести код»); место зарезервировано */}
        <div className="lobby-code">
          {isHost && code ? (
            <button className="lobby-code-btn" data-testid="lobby-code" onClick={props.onCopyCode} title={t.lobbyCopyHint}>
              <span className="lobby-code-val">{code} ⧉</span>
              <span className="lobby-code-hint">{t.lobbyCopyHint}</span>
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
            <span className="lobby-ol">{t.lobbyMap}</span>
            <div className="lobby-tiles">
              {MAP_IDS.map(id => (
                <button key={id} className={`lobby-tile${mapSel === id ? ' lobby-tile--on' : ''}`} data-testid={`lobby-map-${id}`} onClick={() => { if (mapSel !== id) sfx.play2D('ui_toggle'); props.onSetMap(id) }}>
                  {MAP_PREVIEW[id] ? <img className="lobby-pv" src={MAP_PREVIEW[id]} alt={mapLabel(id)} /> : <span className="lobby-pv" />}
                  <span className="lobby-tile-label">{mapLabel(id)}</span>
                </button>
              ))}
              <button className={`lobby-tile lobby-tile--any${mapSel === 'any' ? ' lobby-tile--on' : ''}`} data-testid="lobby-map-any" onClick={() => { if (mapSel !== 'any') sfx.play2D('ui_toggle'); props.onSetMap('any') }}>
                <span className="lobby-pv">✱</span>
                <span className="lobby-tile-label">{t.lobbyAny}</span>
              </button>
            </div>
          </div>
          <div className="lobby-ogrp">
            <span className="lobby-ol">{t.lobbyTime}</span>
            <div className="lobby-segs">
              {MATCH_DURATIONS_MIN.map(m => (
                <button key={m} className={`lobby-segbtn${durationSel === m ? ' lobby-segbtn--on' : ''}`} data-testid={`lobby-time-${m}`} onClick={() => { if (durationSel !== m) sfx.play2D('ui_toggle'); props.onSetDuration(m) }}>{m}</button>
              ))}
              <button className={`lobby-segbtn lobby-segbtn--any${durationSel === 'any' ? ' lobby-segbtn--on' : ''}`} data-testid="lobby-time-any" onClick={() => { if (durationSel !== 'any') sfx.play2D('ui_toggle'); props.onSetDuration('any') }}>{t.lobbyAny}</button>
            </div>
          </div>
        </div>

        {/* нижнее действие: соперник найден → ГОТОВ; иначе → ПОИСК / ПОИСК…+Стоп */}
        {opponent ? (
          <button className={`lobby-hero lobby-hero--go`} data-testid="lobby-ready" onClick={() => { sfx.play2D('ready'); props.onReady() }}>
            ✓ {t.lobbyReady}
          </button>
        ) : searching ? (
          <>
            <button className="lobby-hero lobby-hero--searching" data-testid="lobby-searching" disabled>⌕ {t.lobbySearching}</button>
            <button className="lobby-stop" data-testid="lobby-stop" onClick={props.onStopSearch}>⏹ {t.lobbyStop}</button>
          </>
        ) : (
          <button className="lobby-hero" data-testid="lobby-search" onClick={() => { sfx.play2D('ui_toggle'); props.onSearch() }}>⌕ {t.lobbySearch}</button>
        )}

        <button className="lobby-back" data-testid="lobby-back" onClick={props.onBack}>{opponent ? t.lobbyLeave : t.roomBack}</button>
      </div>
    </div>
  )
}
