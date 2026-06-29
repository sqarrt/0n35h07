import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { IS_DESKTOP } from '../platform'
import { steamNetRelayStatus } from '../steam/steam'
import type { RoomView } from '../net/RoomSession'

const RELAY_POLL_MS = 1000

const box: CSSProperties = {
  position: 'fixed', left: 10, bottom: 10, zIndex: 300,
  font: '11px/1.5 var(--ui-font)', color: '#9fb4c8', letterSpacing: '0.04em',
  background: 'rgba(8,12,18,0.82)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6,
  padding: '6px 9px', whiteSpace: 'pre', pointerEvents: 'none', maxWidth: 360,
}
const ok: CSSProperties = { color: '#7fd99a' }
const bad: CSSProperties = { color: '#f08a8a' }

/** TEMPORARY P2P diagnostic (desktop only): surfaces where a Steam match handshake stalls — the SDR relay status,
 *  whether the transport found the peer, whether ASSIGN arrived, and whether the opponent is in the roster. */
export function SteamNetDiag({ view, searching }: { view: RoomView | null; searching: boolean }) {
  const [relay, setRelay] = useState('…')
  useEffect(() => {
    if (!IS_DESKTOP) return
    let alive = true
    const tick = () => { void steamNetRelayStatus().then(s => { if (alive) setRelay(s) }) }
    tick()
    const h = setInterval(tick, RELAY_POLL_MS)
    return () => { alive = false; clearInterval(h) }
  }, [])
  if (!IS_DESKTOP) return null
  const role = view ? (view.isHost ? 'host' : 'client') : '—'
  const peer = !!view?.foundHost
  const conn = !!view?.connected
  const opp = (view?.roster.length ?? 0) > 1
  const relayOk = relay.includes('Current') || relay.includes('Ok')
  const yn = (b: boolean) => (b ? <span style={ok}>Y</span> : <span style={bad}>N</span>)
  return (
    <div style={box} data-testid="steam-net-diag">
      {'NET  '}relay=<span style={relayOk ? ok : bad}>{relay}</span>{'\n'}
      {'     '}role={role}  searching={searching ? 'Y' : 'N'}{'\n'}
      {'     '}peer={yn(peer)}  assign={yn(conn)}  opponent={yn(opp)}
    </div>
  )
}
