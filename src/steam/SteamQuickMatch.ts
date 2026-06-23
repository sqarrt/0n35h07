import { SteamNet } from '../net/SteamNet'
import {
  steamNetSelf, steamNetSend, steamNetLeaveLobby, steamNetJoinLobby,
  steamMmHost, steamMmSearch, onSteamNetEvent, type SteamNetEvent,
} from './steam'

const RESEARCH_MS = 4000   // while hosting+waiting, keep re-searching to resolve the simultaneous-create race

/**
 * Steam quick-match (the desktop Matchmaking tab). Steam's lobby list is app-scoped, so every
 * public lobby is an 0N35H07 quick-match lobby (friend lobbies are Private → never listed). No
 * cross-play with the web build (that uses WebRTC; this never does).
 *
 * Try-join-else-host: search; if a lobby exists, join it (client); else host a public one and wait.
 * Simultaneous create (both host at once) is resolved deterministically by a re-search — the lower
 * lobby id is the canonical host, so the higher-id host leaves and joins it. The same SteamNet +
 * event listener that drives matchmaking becomes the match transport once paired.
 */
export class SteamQuickMatch {
  private net: SteamNet | null = null
  private ourLobby: string | null = null   // our hosted lobby id (once created)
  private done = false
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly onMatched: (net: SteamNet, role: 'host' | 'client') => void

  constructor(onMatched: (net: SteamNet, role: 'host' | 'client') => void) {
    this.onMatched = onMatched
  }

  /** Begin searching. Resolves false off-Steam (no SteamID). */
  async start(): Promise<boolean> {
    const self = await steamNetSelf()
    if (!self) return false
    this.net = new SteamNet(self, {
      send: (to, data) => { void steamNetSend(to, data) },
      leave: () => { void steamNetLeaveLobby() },
    })
    const unlisten = await onSteamNetEvent(e => this.onEvent(e))
    this.net.setUnlisten(unlisten)   // the match (RoomSession) inherits this listener via net.leave()
    void steamMmSearch()
    this.timer = setInterval(() => { if (!this.done) void steamMmSearch() }, RESEARCH_MS)
    return true
  }

  private onEvent(e: SteamNetEvent): void {
    this.net?.handleEvent(e)
    if (this.done || !this.net) return
    if (e.kind === 'mmResult') this.onMmResult(e.lobbies)
    else if (e.kind === 'lobbyEntered') {
      this.ourLobby = e.lobbyId
      if (e.members.some(m => m !== this.net!.selfId)) this.finish('host')   // someone already in our lobby
    } else if (e.kind === 'peerJoin') {
      this.finish('host')   // a peer joined our hosted lobby
    }
  }

  private onMmResult(lobbies: string[]): void {
    const others = lobbies.filter(id => id !== this.ourLobby)
    if (others.length === 0) {
      if (!this.ourLobby) void steamMmHost()   // nothing to join → host one
      return
    }
    const target = others.reduce((a, b) => (a < b ? a : b))   // lowest id = canonical host
    if (!this.ourLobby || target < this.ourLobby) {
      if (this.ourLobby) { void steamNetLeaveLobby(); this.ourLobby = null }   // abandon ours for the canonical one
      this.finish('client', target)
    }
  }

  private finish(role: 'host' | 'client', joinId?: string): void {
    if (this.done || !this.net) return
    this.done = true
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    if (role === 'client' && joinId) void steamNetJoinLobby(joinId)
    this.onMatched(this.net, role)   // hand the wired SteamNet to RoomSession (peers arrive via events)
  }

  /** Cancel the search (before a match). */
  stop(): void {
    this.done = true
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.net?.leave()   // unsubscribes + leaves the lobby
    this.net = null
  }
}
