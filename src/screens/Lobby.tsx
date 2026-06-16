import { useState, useRef } from 'react'
import type { MapFilter, DurationFilter, BotDifficulty } from '../constants'
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

export type { LobbySlot } from '../components/lobby/types'   // ре-экспорт для App (строит me/opponent)

interface LobbyProps {
  isHost: boolean
  tab: LobbyTab
  me: LobbySlot
  opponent: OppSlot | null
  mapSel: MapFilter
  durationSel: DurationFilter
  searching: boolean
  botDifficulty: BotDifficulty
  onSetTab: (tab: LobbyTab) => void
  onSetBotDifficulty: (d: BotDifficulty) => void
  onFriendSearch: (code: string) => void
  onSetMap: (m: MapFilter) => void
  onSetDuration: (d: DurationFilter) => void
  onSearch: () => void
  onStopSearch: () => void
  onReady: () => void
  onBack: () => void
}

/** Экран лобби с подвкладками Матчмейкинг/С другом/С ботом. Карта/время/слоты — общие; меняется блок режима + действие. */
export function Lobby(props: LobbyProps) {
  const { isHost, tab, me, opponent, mapSel, durationSel, searching } = props
  const t = useT()
  const [roomCode, setRoomCode] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)

  const startFriend = () => { const c = roomCode.trim().toUpperCase(); if (c) props.onFriendSearch(c) }

  // Карта/время блокируются во время активного поиска И когда в слоте человек-соперник:
  // у клиента соперник — это всегда хост (параметры — прерогатива хоста), у хоста — подключившийся человек
  // (параметры уже зарезолвлены). Бот настройки не блокирует (он под контролем хоста).
  const optsLocked = searching || (opponent != null && !opponent.isBot)
  // ПОИСК: на «С другом» доступен только при введённом коде; на матчмейкинге — всегда.
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
            <LobbySeats isHost={isHost} me={me} opponent={opponent} searching={searching} />
          </div>

          {tab === 'friend' && (
            <RoomCodeField value={roomCode} inputRef={codeInputRef} onChange={setRoomCode} onSubmit={startFriend} />
          )}
          {tab === 'bot' && (
            <BotDifficultyPicker difficulty={props.botDifficulty} onSetDifficulty={props.onSetBotDifficulty} />
          )}
        </div>

        <LobbyAction
          tab={tab} opponent={opponent} searching={searching} canSearch={canSearch}
          onReady={props.onReady} onStopSearch={props.onStopSearch} onSearch={doSearch}
        />

        <Button variant="ghost" data-testid="lobby-back" onClick={props.onBack} style={{ width: '100%' }}>{opponent ? t.lobbyLeave : t.roomBack}</Button>
      </div>
    </div>
  )
}
