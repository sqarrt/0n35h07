import {
  steamNetSelf, steamNetCreateLobby, steamNetJoinLobby, steamNetLeaveLobby,
  steamNetMembers, steamNetSend, steamNetInvite, onSteamNetEvent,
} from './steam'

// Dev-only smoke-test harness for the Steam networking primitives (sub-project #4, stage 1),
// before the lobby UI exists. Exposes window.__steamNet and logs every "steam-net" event.
// Two PCs with two *befriended* Steam accounts: host create() + invite(); client joins the
// invite (logs joinRequested) then join(lobbyId); either side send(to, 'ping').
export async function installSteamNetDebug(): Promise<void> {
  const self = await steamNetSelf()
  await onSteamNetEvent(e => console.log('[steam-net]', e))
  const api = {
    self,
    create: () => steamNetCreateLobby(),
    invite: () => steamNetInvite(),
    join: (lobbyId: string) => steamNetJoinLobby(lobbyId),
    members: () => steamNetMembers(),
    send: (to: string, data: string) => steamNetSend(to, data),
    leave: () => steamNetLeaveLobby(),
  }
  ;(window as unknown as { __steamNet: typeof api }).__steamNet = api
  console.log('[steam-net] debug ready. self =', self, '— use window.__steamNet (create/invite/join/members/send/leave)')
}
