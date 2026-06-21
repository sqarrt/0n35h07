import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import type { LobbyTab } from './types'

interface LobbyTabsProps {
  tab: LobbyTab
  onSetTab: (tab: LobbyTab) => void
}

/** Tab bar of the "Play" screen: three sub-tabs. Button widths are fixed (equal shares) — no "jumping". */
export function LobbyTabs({ tab, onSetTab }: LobbyTabsProps) {
  const t = useT()
  const sfx = useSfx()
  const pick = (next: LobbyTab) => { if (next !== tab) { sfx.play2D('ui_toggle'); onSetTab(next) } }
  const item = (key: LobbyTab, label: string) => (
    <button
      className={`lobby-tab${tab === key ? ' lobby-tab--on' : ''}`}
      data-testid={`lobby-tab-${key}`}
      onClick={() => pick(key)}
    >{label}</button>
  )
  return (
    <div className="lobby-tabs" role="tablist">
      {item('matchmaking', t.lobbyTabMatchmaking)}
      {item('friend', t.lobbyTabFriend)}
      {item('bot', t.lobbyTabBot)}
    </div>
  )
}
