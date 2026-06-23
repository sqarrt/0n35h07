import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import { LOBBY_TABS, type LobbyTab } from './types'

interface LobbyTabsProps {
  tab: LobbyTab
  onSetTab: (tab: LobbyTab) => void
}

/** Tab bar of the "Play" screen. Renders the platform's tab set (LOBBY_TABS) — the web build drops
 *  Matchmaking. Button widths are equal shares (`flex:1`), fixed per platform → no "jumping". */
export function LobbyTabs({ tab, onSetTab }: LobbyTabsProps) {
  const t = useT()
  const sfx = useSfx()
  const pick = (next: LobbyTab) => { if (next !== tab) { sfx.play2D('ui_toggle'); onSetTab(next) } }
  const label = (key: LobbyTab) =>
    key === 'matchmaking' ? t.lobbyTabMatchmaking : key === 'friend' ? t.lobbyTabFriend : t.lobbyTabBot
  return (
    <div className="lobby-tabs" role="tablist">
      {LOBBY_TABS.map(key => (
        <button
          key={key}
          className={`lobby-tab${tab === key ? ' lobby-tab--on' : ''}`}
          data-testid={`lobby-tab-${key}`}
          onClick={() => pick(key)}
        >{label(key)}</button>
      ))}
    </div>
  )
}
