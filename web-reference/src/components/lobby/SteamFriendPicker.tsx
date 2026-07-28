import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import { steamFriendsList, type SteamFriend } from '../../steam/steam'

const FRIENDS_REFRESH_MS = 5000   // refresh online status while the modal is open

interface SteamFriendPickerProps {
  open: boolean
  forming: boolean                              // lobby still being created → a note instead of the list
  onPick: (id: string, name: string) => void    // invite this friend (and remember whom)
  onClose: () => void
}

/**
 * Steam "Choose a friend" modal — the single entry point of "Play with friend" (desktop). Opened from
 * the empty opponent seat. A search box + a fixed-height scrollable list of ONLINE friends; clicking a
 * row sends the invite and closes. Dismissed by Esc / backdrop click / ✕.
 *
 * Rendered in a portal to <body> so the fixed-position backdrop covers the viewport regardless of any
 * transforms on the lobby panel. The list area is a fixed-height scroll region, so a long friends list
 * never resizes the modal.
 */
export function SteamFriendPicker({ open, forming, onPick, onClose }: SteamFriendPickerProps) {
  const t = useT()
  const sfx = useSfx()
  const [friends, setFriends] = useState<SteamFriend[]>([])
  const [query, setQuery] = useState('')

  // Poll the friends list only while the modal is open.
  useEffect(() => {
    if (!open) return
    let alive = true
    const load = () => { void steamFriendsList().then(f => { if (alive) setFriends(f) }) }
    load()
    const id = setInterval(load, FRIENDS_REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [open])

  // Fresh search box on each open.
  useEffect(() => { if (open) setQuery('') }, [open])

  // Esc closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const online = useMemo(() => friends.filter(f => f.online), [friends])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? online.filter(f => f.name.toLowerCase().includes(q)) : online
  }, [online, query])

  if (!open) return null

  const pick = (f: SteamFriend) => { sfx.play2D('ui_toggle'); onPick(f.id, f.name) }
  const close = () => { sfx.play2D('ui_toggle'); onClose() }

  return createPortal(
    <div className="lobby-picker-backdrop" data-testid="lobby-friend-picker" onClick={close}>
      <div className="lobby-picker" onClick={e => e.stopPropagation()}>
        <div className="lobby-picker-head">
          <span className="lobby-picker-ttl">{t.lobbyPickFriend}</span>
          <button className="lobby-picker-x" data-testid="lobby-picker-close" onClick={close}>✕</button>
        </div>
        <div className="lobby-picker-search">
          <input
            className="lobby-picker-input" data-testid="lobby-picker-search" autoFocus
            value={query} placeholder={t.lobbyPickerSearch} aria-label={t.lobbyPickerSearch}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="lobby-picker-count">{t.lobbyFriendsOnline} · {online.length}</div>
        <div className="lobby-picker-list" data-testid="lobby-picker-list">
          {forming ? (
            <div className="lobby-picker-note">{t.lobbyPreparingLobby}</div>
          ) : shown.length === 0 ? (
            <div className="lobby-picker-note">{t.lobbyNoFriends}</div>
          ) : (
            shown.map(f => (
              <button key={f.id} className="lobby-picker-row" data-testid={`lobby-friend-${f.id}`} onClick={() => pick(f)}>
                <span className="lobby-picker-dot" />
                <span className="lobby-picker-name">{f.name}</span>
                <span className="lobby-picker-invite">{t.lobbyInvite}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
