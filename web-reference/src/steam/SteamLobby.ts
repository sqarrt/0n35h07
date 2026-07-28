import { SteamNet } from '../net/SteamNet'
import {
  steamNetSelf, steamNetCreateLobby, steamNetJoinLobby, steamNetSend, steamNetLeaveLobby,
  onSteamNetEvent, type SteamNetEvent,
} from './steam'

// Steam lobby lifecycle is async/event-driven (a command kicks it off; a 'lobbyEntered' event
// confirms it). This wraps that so App can treat a Steam match like the synchronous transports:
// await a ready SteamNet, then hand it to RoomSession. Off-Steam every entry resolves to null.

const LOBBY_READY_TIMEOUT_MS = 8000   // never hang the UI waiting for lobbyEntered

function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return Promise.race([p, new Promise<void>(resolve => setTimeout(resolve, ms))])
}

/** Build a SteamNet wired to the event stream + a promise that resolves on the first lobbyEntered. */
async function buildSteamNet(): Promise<{ net: SteamNet; ready: Promise<void> } | null> {
  const self = await steamNetSelf()
  if (!self) return null
  const net = new SteamNet(self, {
    send: (to, data) => { void steamNetSend(to, data) },
    leave: () => { void steamNetLeaveLobby() },
  })
  let resolveReady!: () => void
  const ready = new Promise<void>(r => { resolveReady = r })
  const unlisten = await onSteamNetEvent((e: SteamNetEvent) => {
    net.handleEvent(e)
    if (e.kind === 'lobbyEntered') resolveReady()
  })
  net.setUnlisten(unlisten)
  return { net, ready }
}

/** Host a Private lobby for a friend; resolves a ready SteamNet (or null off-Steam). */
export async function hostFriendLobby(): Promise<SteamNet | null> {
  const built = await buildSteamNet()
  if (!built) return null
  void steamNetCreateLobby()
  await withTimeout(built.ready, LOBBY_READY_TIMEOUT_MS)
  return built.net
}

/** Join a lobby by id (from a joinRequested event); resolves a ready SteamNet (or null off-Steam). */
export async function joinSteamLobby(lobbyId: string): Promise<SteamNet | null> {
  const built = await buildSteamNet()
  if (!built) return null
  void steamNetJoinLobby(lobbyId)
  await withTimeout(built.ready, LOBBY_READY_TIMEOUT_MS)
  return built.net
}
