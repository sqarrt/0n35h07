import { useState, useRef } from 'react'
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
import { SteamInvitePanel } from '../components/lobby/SteamInvitePanel'

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
  // Steam "With friend" (desktop): the lobby is still forming + the two invite actions.
  steamFriendForming?: boolean
  onSteamInviteOverlay?: () => void
  onSteamInviteFriend?: (id: string) => void
}

/** Lobby screen with Matchmaking/With a friend/With a bot sub-tabs. Map/time/slots are shared; the mode block + action change. */
export function Lobby(props: LobbyProps) {
  const { isHost, tab, me, opponent, mapSel, durationSel, searching } = props
  const t = useT()
  const [roomCode, setRoomCode] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)

  const startFriend = () => { const c = roomCode.trim().toUpperCase(); if (c) props.onFriendSearch(c) }

  // Lock map/time:
  //  • during an active search;
  //  • on the client (human opponent = host) — settings are always someone else's;
  //  • on the host with a human in the slot — only on matchmaking (params are resolved); on "With a friend" the host
  //    can change params live (RoomSession sends an updated Assign to the client). A bot doesn't lock.
  const humanOpp = opponent != null && !opponent.isBot
  const optsLocked = searching || (humanOpp && !isHost) || (humanOpp && isHost && tab !== 'friend')
  // On the Steam (desktop) build "With a friend" is invite-based (no room code) — a different panel + action.
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
              botEdit={isHost && tab === 'bot' && opponent?.isBot ? { name: props.botName, onSetName: props.onSetBotName } : undefined} />
          </div>

          {tab === 'friend' && (steamFriend
            ? <SteamInvitePanel
                forming={!!props.steamFriendForming} disabled={opponent != null}
                onInviteOverlay={() => props.onSteamInviteOverlay?.()} onInviteFriend={id => props.onSteamInviteFriend?.(id)} />
            : <RoomCodeField value={roomCode} inputRef={codeInputRef} onChange={setRoomCode} onSubmit={startFriend} />
          )}
          {tab === 'bot' && (
            <BotDifficultyPicker difficulty={props.botDifficulty} onSetDifficulty={props.onSetBotDifficulty} />
          )}
        </div>

        <LobbyAction
          tab={tab} opponent={opponent} searching={searching} canSearch={canSearch} steamFriend={steamFriend}
          onReady={props.onReady} onStopSearch={props.onStopSearch} onSearch={doSearch}
        />

        <Button variant="ghost" data-testid="lobby-back" onClick={props.onBack} style={{ width: '100%' }}>{opponent ? t.lobbyLeave : t.roomBack}</Button>
      </div>
    </div>
  )
}
