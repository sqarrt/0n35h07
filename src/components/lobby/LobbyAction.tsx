import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import type { OppSlot } from './types'

interface LobbyActionProps {
  opponent: OppSlot | null
  searching: boolean
  isHost: boolean
  hasCode: boolean              // клиент ввёл код хоста → ПОИСК ведёт в конкретную комнату
  onReady: () => void
  onStopSearch: () => void
  onSearch: () => void
  onSubmitCode: () => void
}

const FULL = { width: '100%' } as const

/** Нижнее действие: соперник найден → ГОТОВ; идёт поиск → СТОП; иначе → ПОИСК. Тот же Button, что и «Назад». */
export function LobbyAction({ opponent, searching, isHost, hasCode, onReady, onStopSearch, onSearch, onSubmitCode }: LobbyActionProps) {
  const t = useT()

  if (opponent) {
    return <Button variant="primary" className="btn--go" data-testid="lobby-ready" style={FULL} onClick={onReady}>{t.lobbyReady}</Button>
  }
  if (searching) {
    return <Button variant="primary" className="btn--stop" data-testid="lobby-stop" style={FULL} onClick={onStopSearch}>{t.lobbyStop}</Button>
  }
  return (
    <Button variant="primary" data-testid="lobby-search" style={FULL} onClick={() => { if (!isHost && hasCode) onSubmitCode(); else onSearch() }}>{t.lobbySearch}</Button>
  )
}
