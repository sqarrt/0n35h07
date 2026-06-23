import { useState, useRef, useEffect } from 'react'
import type { MapFilter, DurationFilter, BotDifficulty } from '../constants'
import { IS_DESKTOP } from '../platform'
import { Button } from '../ui/Button'
import { useT } from '../i18n'
import type { LobbySlot, OppSlot, LobbyTab } from '../components/lobby/types'
import { LobbyTabs } from '../components/lobby/LobbyTabs'
import { LobbySeats } from '../components/lobby/LobbySeats'
import { MapPicker } from '../components/lobby/MapPicker'
import { TimePicker } from '../components/lobby/TimePicker'
import { LobbyAction } from '../components/lobby/LobbyAction'
import { RoomCodeField } from '../components/lobby/RoomCodeField'
import { BotDifficultyPicker } from '../components/lobby/BotDifficultyPicker'
import { SteamFriendPicker } from '../components/lobby/SteamFriendPicker'

export type { LobbySlot } from '../components/lobby/types'   // re-export for App (builds me/opponent)

interface LobbyProps {
  isHost: boolean
  tab: LobbyTab
  me: LobbySlot
  opponent: OppSlot | null
  mapSel: MapFilter
  durationSel: DurationFilter
  searching: boolean
  botDifficulty: BotDifficulty
  botName: string
  onSetTab: (tab: LobbyTab) => void
  onSetBotDifficulty: (d: BotDifficulty) => void
  onSetBotName: (name: string) => void
  onFriendSearch: (code: string) => void
  onSetMap: (m: MapFilter) => void
  onSetDuration: (d: DurationFilter) => void
  onSearch: () => void
  onStopSearch: () => void
  onReady: () => void
  onBack: () => void
  // Steam "With friend" (desktop): the lobby is still forming + invite a specific friend.
  steamFriendForming?: boolean
  onSteamInviteFriend?: (id: string) => void
}

/** Lobby screen with Matchmaking/With a friend/With a bot sub-tabs. Map/time/slots are shared; the mode block + action change. */
export function Lobby(props: LobbyProps) {
  const { isHost, tab, me, opponent, mapSel, durationSel, searching } = props
  const t = useT()
  const [roomCode, setRoomCode] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)
  // Steam "With friend": the friend picker modal + which friend we invited (the seat's "waiting" state).
  const [pickerOpen, setPickerOpen] = useState(false)
  const [invited, setInvited] = useState<{ id: string; name: string } | null>(null)
  // Once the friend actually joins (opponent fills) the pending state is irrelevant — clear it so a later
  // leave returns the seat to the CTA, not a stale "waiting".
  useEffect(() => { if (opponent) setInvited(null) }, [opponent])
  // Leaving the "With friend" tab cancels any pending invite and closes the modal.
  useEffect(() => { if (tab !== 'friend') { setInvited(null); setPickerOpen(false) } }, [tab])

  const startFriend = () => { const c = roomCode.trim().toUpperCase(); if (c) props.onFriendSearch(c) }

  // Lock map/time:
  //  • during an active search;
  //  • on the client (human opponent = host) — settings are always someone else's;
  //  • on the host with a human in the slot — only on matchmaking (params are resolved); on "With a friend" the host
  //    can change params live (RoomSession sends an updated Assign to the client). A bot doesn't lock.
  const humanOpp = opponent != null && !opponent.isBot
  const optsLocked = searching || (humanOpp && !isHost) || (humanOpp && isHost && tab !== 'friend')
  // On the Steam (desktop) build "With a friend" is invite-based (no room code): the empty opponent seat is
  // the single invite entry point (click → friend picker), so no room-code field is rendered.
  const steamFriend = IS_DESKTOP && tab === 'friend'
  // SEARCH: on web "With a friend" available only with a code entered; on matchmaking — always.
  const canSearch = tab === 'friend' ? !!roomCode.trim() : true
  const doSearch = tab === 'friend' ? startFriend : props.onSearch

  return (
    <div className="panel-fill" style={{ justifyContent: 'flex-start' }}>
      <div className="lobby">
        <div className="lobby-body">
          <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>{t.menuPlay}</h2>

          <LobbyTabs tab={tab} onSetTab={props.onSetTab} />

          <div className={`lobby-opts${optsLocked ? ' lobby-opts--locked' : ''}`}>
            <MapPicker mapSel={mapSel} onSetMap={props.onSetMap} />
            <TimePicker durationSel={durationSel} onSetDuration={props.onSetDuration} />
          </div>

          <div className="lobby-ogrp">
            <span className="lobby-ol">// {t.lobbyPlayers}</span>
            <LobbySeats isHost={isHost} me={me} opponent={opponent} searching={searching}
              botEdit={isHost && tab === 'bot' && opponent?.isBot ? { name: props.botName, onSetName: props.onSetBotName } : undefined}
              inviteSeat={steamFriend && !opponent ? { invitedName: invited?.name ?? null, onInvite: () => setPickerOpen(true), onCancel: () => setInvited(null) } : undefined} />
          </div>

          {tab === 'friend' && !steamFriend && (
            <RoomCodeField value={roomCode} inputRef={codeInputRef} onChange={setRoomCode} onSubmit={startFriend} />
          )}
          {tab === 'bot' && (
            <BotDifficultyPicker difficulty={props.botDifficulty} onSetDifficulty={props.onSetBotDifficulty} />
          )}
        </div>

        {steamFriend && (
          <SteamFriendPicker
            open={pickerOpen} forming={!!props.steamFriendForming}
            onClose={() => setPickerOpen(false)}
            onPick={(id, name) => { props.onSteamInviteFriend?.(id); setInvited({ id, name }); setPickerOpen(false) }} />
        )}

        <LobbyAction
          tab={tab} opponent={opponent} searching={searching} canSearch={canSearch}
          steamFriend={steamFriend} steamFriendInvited={!!invited}
          onReady={props.onReady} onStopSearch={props.onStopSearch} onSearch={doSearch}
        />

        <Button variant="ghost" data-testid="lobby-back" onClick={props.onBack} style={{ width: '100%' }}>{opponent ? t.lobbyLeave : t.roomBack}</Button>
      </div>
    </div>
  )
}
