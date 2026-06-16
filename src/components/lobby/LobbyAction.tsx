import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import type { LobbyTab, OppSlot } from './types'

interface LobbyActionProps {
  tab: LobbyTab
  opponent: OppSlot | null
  searching: boolean
  hasFriendCode: boolean        // на вкладке «С другом» введён код → действие = ВОЙТИ
  onReady: () => void
  onStopSearch: () => void
  onSearch: () => void
  onJoin: () => void
}

const FULL = { width: '100%' } as const

/**
 * Нижнее действие, зависящее от вкладки:
 * - соперник в слоте → ГОТОВ;
 * - Матчмейкинг: идёт поиск → СТОП, иначе → ПОИСК;
 * - С другом: введён код друга → ВОЙТИ, иначе ждём друга → ГОТОВ (disabled);
 * - С ботом: бот всегда в слоте → попадает в ветку ГОТОВ выше.
 */
export function LobbyAction({ tab, opponent, searching, hasFriendCode, onReady, onStopSearch, onSearch, onJoin }: LobbyActionProps) {
  const t = useT()

  if (opponent) {
    return <Button variant="primary" className="btn--go" data-testid="lobby-ready" style={FULL} onClick={onReady}>{t.lobbyReady}</Button>
  }
  if (tab === 'matchmaking') {
    if (searching) return <Button variant="primary" className="btn--stop" data-testid="lobby-stop" style={FULL} onClick={onStopSearch}>{t.lobbyStop}</Button>
    return <Button variant="primary" data-testid="lobby-search" style={FULL} onClick={onSearch}>{t.lobbySearch}</Button>
  }
  if (tab === 'friend') {
    if (hasFriendCode) return <Button variant="primary" data-testid="lobby-join" style={FULL} onClick={onJoin}>{t.lobbyJoin}</Button>
    return <Button variant="primary" data-testid="lobby-ready" style={FULL} disabled onClick={onReady}>{t.lobbyReady}</Button>
  }
  // bot: соперник-бот добавляется при входе на вкладку → сюда дойти можно лишь на миг до addBot
  return <Button variant="primary" data-testid="lobby-ready" style={FULL} disabled onClick={onReady}>{t.lobbyReady}</Button>
}
