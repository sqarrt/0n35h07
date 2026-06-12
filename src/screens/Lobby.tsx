import { useState, useRef } from 'react'
import type { MapFilter, DurationFilter, BotDifficulty } from '../constants'
import { Button } from '../ui/Button'
import { useT } from '../i18n'
import type { LobbySlot, OppSlot } from './lobby/types'
import { LobbySeats } from './lobby/LobbySeats'
import { MapPicker } from './lobby/MapPicker'
import { TimePicker } from './lobby/TimePicker'
import { LobbyCode } from './lobby/LobbyCode'
import { LobbyAction } from './lobby/LobbyAction'
import { RolePicker } from './lobby/RolePicker'
import { BotPicker } from './lobby/BotPicker'

export type { LobbySlot } from './lobby/types'   // ре-экспорт для App (строит me/opponent)

interface LobbyProps {
  isHost: boolean
  me: LobbySlot
  opponent: OppSlot | null
  mapSel: MapFilter
  durationSel: DurationFilter
  code: string | null
  searching: boolean
  onToggleRole: () => void
  onAddBot: (d?: BotDifficulty) => void
  onRemoveBot: () => void
  onSetBotDifficulty: (d: BotDifficulty) => void
  onEnterCode: (code: string) => void
  onSetMap: (m: MapFilter) => void
  onSetDuration: (d: DurationFilter) => void
  onSearch: () => void
  onStopSearch: () => void
  onReady: () => void
  onBack: () => void
}

/** Экран лобби: разделы карты/времени, код хоста, слоты VS, нижнее действие. Состоит из под-компонентов lobby/*. */
export function Lobby(props: LobbyProps) {
  const { isHost, me, opponent, mapSel, durationSel, code, searching } = props
  const t = useT()
  const [codeInput, setCodeInput] = useState('')
  const [showOther, setShowOther] = useState(false)   // раздел «// ПРОЧЕЕ» (код + слоты) скрыт по умолчанию
  const codeInputRef = useRef<HTMLInputElement>(null)
  const locked = opponent !== null

  const submitCode = () => { const c = codeInput.trim().toUpperCase(); if (c) props.onEnterCode(c) }

  return (
    <div className="panel-fill" style={{ justifyContent: 'flex-start' }}>
      <div className="lobby">
        <div className="lobby-body">
          <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>{t.menuPlay}</h2>

          <div className={`lobby-opts${locked ? ' lobby-opts--locked' : ''}`}>
            <MapPicker mapSel={mapSel} onSetMap={props.onSetMap} />
            <TimePicker durationSel={durationSel} onSetDuration={props.onSetDuration} />
          </div>

          {/* // ИГРОКИ — слоты VS (только показ; управление ролью/ботом/кодом — в «// ПРОЧЕЕ») */}
          <div className="lobby-ogrp">
            <span className="lobby-ol">// {t.lobbyPlayers}</span>
            <LobbySeats isHost={isHost} me={me} opponent={opponent} searching={searching} />
          </div>

          {/* // ПРОЧЕЕ — сетевая роль, код хоста, бот; свёрнут по умолчанию */}
          <div className="lobby-ogrp lobby-other">
            <button className="lobby-ol-toggle" data-testid="lobby-other-toggle" onClick={() => setShowOther(v => !v)}>
              <span className="lobby-ol-chevron" aria-hidden="true">{showOther ? '▾' : '▸'}</span> // {t.lobbyOther}
            </button>
            {showOther && (
              <>
                <RolePicker isHost={isHost} disabled={opponent !== null} onToggleRole={props.onToggleRole} />
                <LobbyCode
                  isHost={isHost} code={code} codeInput={codeInput} inputRef={codeInputRef}
                  onCodeInput={setCodeInput} onSubmit={submitCode}
                />
                <BotPicker
                  disabled={!isHost} slotTaken={opponent !== null} hasBot={opponent?.isBot ?? false}
                  onAdd={props.onAddBot} onRemove={props.onRemoveBot} onSetDifficulty={props.onSetBotDifficulty}
                />
              </>
            )}
          </div>
        </div>

        {/* нижний блок прижат к низу подложки: действие (ПОИСК/ГОТОВ/СТОП) сверху, «Назад» под ним */}
        <LobbyAction
          opponent={opponent} searching={searching} isHost={isHost} hasCode={!!codeInput.trim()}
          onReady={props.onReady} onStopSearch={props.onStopSearch} onSearch={props.onSearch} onSubmitCode={submitCode}
        />

        <Button variant="ghost" data-testid="lobby-back" onClick={props.onBack} style={{ width: '100%' }}>{opponent ? t.lobbyLeave : t.roomBack}</Button>
      </div>
    </div>
  )
}
