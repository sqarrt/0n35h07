import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import type { LobbyTab } from './types'

interface LobbyTabsProps {
  tab: LobbyTab
  onSetTab: (tab: LobbyTab) => void
}

/** Таб-бар экрана «Играть»: три подвкладки. Ширина кнопок фиксирована (равные доли) — без «прыжков». */
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
