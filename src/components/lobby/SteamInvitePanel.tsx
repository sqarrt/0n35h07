import { useState, useEffect, type CSSProperties } from 'react'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import { steamFriendsList, type SteamFriend } from '../../steam/steam'

const FRIENDS_REFRESH_MS = 5000   // refresh online status while the panel is open
const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }

interface SteamInvitePanelProps {
  forming: boolean                       // lobby still being created (brief)
  disabled: boolean                      // a friend already took the slot → dim in place (no layout shift)
  onInviteOverlay: () => void            // open the Steam overlay invite dialog
  onInviteFriend: (id: string) => void   // invite a specific friend to the lobby
}

/**
 * Steam "Play with friend" panel — the two paths: a Steam overlay invite, and an in-game online
 * friends list with per-row INVITE. Sits in the same slot the room-code field uses on web.
 *
 * No "jumping": the panel has a fixed min-height and the friends list is a fixed-height scroll
 * region, so the box never resizes as state swaps (forming → friends → empty) or the friend count
 * changes. Rows are fixed-height with an ellipsised name. When a friend joins, the panel dims in
 * place (kept mounted) — the layout above (seats/heading) is untouched.
 */
export function SteamInvitePanel({ forming, disabled, onInviteOverlay, onInviteFriend }: SteamInvitePanelProps) {
  const t = useT()
  const sfx = useSfx()
  const [friends, setFriends] = useState<SteamFriend[]>([])

  useEffect(() => {
    let alive = true
    const load = () => { void steamFriendsList().then(f => { if (alive) setFriends(f) }) }
    load()
    const id = setInterval(load, FRIENDS_REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const online = friends.filter(f => f.online)
  const overlay = () => { sfx.play2D('ui_toggle'); onInviteOverlay() }
  const invite = (id: string) => { sfx.play2D('ui_toggle'); onInviteFriend(id) }

  return (
    <div className={`lobby-steam${disabled ? ' lobby-steam--off' : ''}`} data-testid="lobby-steam-invite" aria-disabled={disabled}>
      <div style={LABEL}>{t.lobbyInviteSection}</div>
      <button className="lobby-steam-overlay" data-testid="lobby-invite-overlay" disabled={forming} onClick={overlay}>{t.lobbyInviteOverlay}</button>
      <div className="lobby-steam-or"><span>{t.lobbyInviteOrPick}</span></div>
      <div className="lobby-steam-friends" data-testid="lobby-friends">
        {forming ? (
          <div className="lobby-steam-note">{t.lobbyPreparingLobby}</div>
        ) : online.length === 0 ? (
          <div className="lobby-steam-note">{t.lobbyNoFriends}</div>
        ) : (
          online.map(f => (
            <div key={f.id} className="lobby-friend">
              <span className="lobby-friend-dot" />
              <span className="lobby-friend-name">{f.name}</span>
              <button className="lobby-friend-invite" data-testid={`lobby-friend-${f.id}`} onClick={() => invite(f.id)}>{t.lobbyInvite}</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
