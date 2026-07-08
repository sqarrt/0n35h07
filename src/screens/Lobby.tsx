import { useState, useEffect } from 'react'
import type { MapFilter, DurationFilter, BotDifficulty } from '../constants'
import { IS_DESKTOP } from '../platform'
import { onSteamInviteDeclined } from '../steam/steam'
import { Button } from '../ui/Button'
import { useT } from '../i18n'
import type { SeatView, SeatZone, PendingInvite } from '../components/lobby/types'
import type { GameMode } from '../game/modes'
import { ModeCarousel } from '../components/lobby/ModeCarousel'
import { Seats } from '../components/lobby/Seats'
import { MapPicker } from '../components/lobby/MapPicker'
import { TimePicker } from '../components/lobby/TimePicker'
import { SteamFriendPicker } from '../components/lobby/SteamFriendPicker'

const ROOM_CODE_LEN = 4

interface LobbyProps {
  isHost: boolean
  mode: GameMode
  seats: SeatView[]
  seatedPeerIds: string[]      // transport peer ids currently seated (prunes accepted Steam invites)
  connected: boolean           // client: Assign received (gates READY)
  myReady: boolean
  canStart: boolean            // host: enough seats filled for this mode
  searching: boolean
  joinCode: string | null      // web host: the room code revealed inside a seat's invite zone
  mapSel: MapFilter
  durationSel: DurationFilter
  onSetMode: (m: GameMode) => void
  onSeatClick: (slot: number, zone: SeatZone) => void
  onBotRemove: (slot: number) => void
  onBotName: (slot: number, name: string) => void
  onBotDifficulty: (slot: number, d: BotDifficulty) => void
  onSetMap: (m: MapFilter) => void
  onSetDuration: (d: DurationFilter) => void
  onJoinByCode: (code: string) => void   // web: join someone's room as a guest
  onSearch: () => void                   // desktop Duel: Steam quick-match
  onStopSearch: () => void
  onReady: () => void
  onBack: () => void
  // Steam (desktop): the lobby is still forming + invite a specific friend.
  steamFriendForming?: boolean
  onSteamInviteFriend?: (id: string) => void
}

/** The "Play" screen, no tabs: mode carousel → map/time → seats (invite/bot/code zones per seat) →
 *  one auto-switching action button (SEARCH / STOP / READY / waiting). */
export function Lobby(props: LobbyProps) {
  const { isHost, mode, seats, searching } = props
  const t = useT()
  // Steam invites we are waiting on (desktop host): projected onto free seats by <Seats>.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [invites, setInvites] = useState<PendingInvite[]>([])
  // Once an invited friend actually SITS (their peer id appears among the seated), its pending entry is done.
  useEffect(() => {
    if (!props.seatedPeerIds.length) return
    setInvites(prev => {
      const next = prev.filter(i => !props.seatedPeerIds.includes(i.id))
      return next.length === prev.length ? prev : next
    })
  }, [props.seatedPeerIds])
  // An invited friend declined → drop exactly that pending entry.
  useEffect(() => {
    if (!IS_DESKTOP) return
    let alive = true; let un = () => {}
    void onSteamInviteDeclined(declinerId => setInvites(prev => prev.filter(i => i.id !== declinerId)))
      .then(u => { if (alive) un = u; else u() })
    return () => { alive = false; un() }
  }, [])

  // Web guest path: a compact "join by code" field below the seats.
  const [code, setCode] = useState('')
  const joinGo = () => { const c = code.trim().toUpperCase(); if (c) props.onJoinByCode(c) }

  const steamInvites = IS_DESKTOP && isHost
  const freeSeats = seats.filter(s => s.entry === null).length
  const othersSeated = seats.some(s => s.entry !== null && !s.mine)
  // Map/time are the host's: guests always see them locked; searching locks them for everyone.
  const optsLocked = searching || !isHost

  // The single action button: same size in every state (no layout jumps).
  const action = searching
    ? <Button variant="primary" className="btn--stop" data-testid="lobby-stop" style={{ width: '100%' }} onClick={props.onStopSearch}>{t.lobbyStop}</Button>
    : invites.length > 0
      ? <Button variant="primary" data-testid="lobby-waiting" style={{ width: '100%' }} disabled>{t.lobbyWaitingFriend}</Button>
      : IS_DESKTOP && isHost && mode === '1v1' && freeSeats > 0
        ? <Button variant="primary" data-testid="lobby-search" style={{ width: '100%' }} onClick={props.onSearch}>{t.lobbySearch}</Button>
        : props.myReady
          ? <Button variant="primary" data-testid="lobby-waiting" style={{ width: '100%' }} disabled>{t.lobbyWaitOthers}</Button>
          : <Button variant="primary" className="btn--go" data-testid="lobby-ready" style={{ width: '100%' }}
              disabled={isHost ? !props.canStart : !props.connected} onClick={props.onReady}>{t.lobbyReady}</Button>

  return (
    <div className="panel-fill panel-fill--bleed" style={{ justifyContent: 'flex-start' }}>
      <div className="lobby">
        <div className="lobby-body">
          <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>{t.menuPlay}</h2>

          <ModeCarousel mode={mode} enabled={isHost && !searching} onSetMode={props.onSetMode} />

          <div className={`lobby-opts${optsLocked ? ' lobby-opts--locked' : ''}`}>
            <MapPicker mapSel={props.mapSel} onSetMap={props.onSetMap} />
            <TimePicker durationSel={props.durationSel} onSetDuration={props.onSetDuration} />
          </div>

          <div className="lobby-ogrp">
            <span className="lobby-ol">// {t.lobbyPlayers}</span>
            <Seats mode={mode} isHost={isHost} seats={seats} searching={searching}
              onSeatClick={props.onSeatClick} onBotRemove={props.onBotRemove}
              onBotName={props.onBotName} onBotDifficulty={props.onBotDifficulty}
              invite={steamInvites ? {
                pending: invites,
                onInvite: () => setPickerOpen(true),
                onCancel: id => setInvites(prev => prev.filter(i => i.id !== id)),
              } : undefined}
              joinCode={props.joinCode} />
          </div>

          {!IS_DESKTOP && (
            <div className="join-code">
              <span className="lobby-ol">// {t.lobbyJoinByCode}</span>
              <div className="join-code-row">
                <input className="input join-code-input" data-testid="join-code-field"
                  value={code} maxLength={ROOM_CODE_LEN}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') joinGo() }} />
                <Button className="join-code-go" data-testid="join-code-go" disabled={!code.trim()} onClick={joinGo}>→</Button>
              </div>
            </div>
          )}
        </div>

        {steamInvites && (
          <SteamFriendPicker
            open={pickerOpen} forming={!!props.steamFriendForming}
            onClose={() => setPickerOpen(false)}
            onPick={(id, name) => { props.onSteamInviteFriend?.(id); setInvites(prev => (prev.some(i => i.id === id) ? prev : [...prev, { id, name }])); setPickerOpen(false) }} />
        )}

        <div data-testid="lobby-action" style={{ width: '100%' }}>{action}</div>

        <Button variant="ghost" data-testid="lobby-back" onClick={props.onBack} style={{ width: '100%' }}>{othersSeated ? t.lobbyLeave : t.roomBack}</Button>
      </div>
    </div>
  )
}
