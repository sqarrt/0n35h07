import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import type { LobbyTab, OppSlot } from './types'

interface LobbyActionProps {
  tab: LobbyTab
  opponent: OppSlot | null
  searching: boolean
  canSearch: boolean            // ПОИСК доступен (на «С другом» — только когда введён код)
  onReady: () => void
  onStopSearch: () => void
  onSearch: () => void
}

const FULL = { width: '100%' } as const

/**
 * Нижнее действие:
 * - соперник в слоте → ГОТОВ;
 * - идёт поиск → СТОП;
 * - вкладка «С ботом» (бот вот-вот в слоте) → ГОТОВ (disabled до addBot);
 * - иначе (Матчмейкинг / С другом) → ПОИСК (disabled, если искать пока нечем).
 */
export function LobbyAction({ tab, opponent, searching, canSearch, onReady, onStopSearch, onSearch }: LobbyActionProps) {
  const t = useT()

  if (opponent) {
    return <Button variant="primary" className="btn--go" data-testid="lobby-ready" style={FULL} onClick={onReady}>{t.lobbyReady}</Button>
  }
  if (searching) {
    return <Button variant="primary" className="btn--stop" data-testid="lobby-stop" style={FULL} onClick={onStopSearch}>{t.lobbyStop}</Button>
  }
  if (tab === 'bot') {
    return <Button variant="primary" data-testid="lobby-ready" style={FULL} disabled onClick={onReady}>{t.lobbyReady}</Button>
  }
  return <Button variant="primary" data-testid="lobby-search" style={FULL} disabled={!canSearch} onClick={onSearch}>{t.lobbySearch}</Button>
}
