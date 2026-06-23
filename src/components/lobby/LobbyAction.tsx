import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import type { LobbyTab, OppSlot } from './types'

interface LobbyActionProps {
  tab: LobbyTab
  opponent: OppSlot | null
  searching: boolean
  canSearch: boolean            // SEARCH available (on "With friend" — only once a code is entered)
  steamFriend: boolean          // Steam "With friend": no code/search → the seat is the invite CTA
  steamFriendInvited: boolean   // Steam "With friend": an invite was sent → waiting for the friend to accept
  onReady: () => void
  onStopSearch: () => void
  onSearch: () => void
}

const FULL = { width: '100%' } as const

/**
 * Bottom action:
 * - opponent in slot → READY;
 * - search in progress → STOP;
 * - "With bot" tab (bot about to fill the slot) → READY (disabled until addBot);
 * - Steam "With friend", no opponent → a disabled hint (same height): before inviting "CHOOSE A FRIEND",
 *   after inviting "WAITING FOR A FRIEND…" — the seat itself is the action, this line is just status;
 * - otherwise (Matchmaking / web With friend) → SEARCH (disabled if there's nothing to search yet).
 */
export function LobbyAction({ tab, opponent, searching, canSearch, steamFriend, steamFriendInvited, onReady, onStopSearch, onSearch }: LobbyActionProps) {
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
  if (steamFriend) {
    return <Button variant="primary" data-testid="lobby-waiting" style={FULL} disabled>{steamFriendInvited ? t.lobbyWaitingFriend : t.lobbyPickFriend}</Button>
  }
  return <Button variant="primary" data-testid="lobby-search" style={FULL} disabled={!canSearch} onClick={onSearch}>{t.lobbySearch}</Button>
}
