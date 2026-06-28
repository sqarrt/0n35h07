// Steam matchmaking + P2P networking (sub-project #4, Option A).
//
// A match = a Private Steam lobby (max 2). The host creates it and invites via the overlay /
// Rich Presence "Join game"; the client joins by LobbyId (no room code). Gameplay messages go
// over NetworkingMessages (SDR, reliable) between the two SteamIDs — no TURN.
//
// All commands soft-fail (false / None / no-op) without Steam. Events stream to JS over the
// single Tauri event "steam-net" (see NetEvent). The receive pump + Steam callbacks run on the
// shared callback thread (see start_pump).

use std::sync::{Arc, Mutex};
use std::time::Duration;
use steamworks::networking_types::{NetworkingIdentity, SendFlags};
use steamworks::{
  ChatMemberStateChange, Client, FriendFlags, FriendState, GameLobbyJoinRequested, GameOverlayActivated,
  LobbyChatUpdate, LobbyId, LobbyType, SingleClient, SteamId,
};
use tauri::{AppHandle, Emitter, State};

use crate::steam::SteamState;

const NET_CHANNEL: u32 = 0; // NetworkingMessages channel for gameplay traffic
const NET_PUMP_MS: u64 = 8; // ~120 Hz: run callbacks + drain incoming messages
const LOBBY_MAX_MEMBERS: u32 = 2; // strict 1v1
const STEAM_NET_EVENT: &str = "steam-net";
const RP_CONNECT_KEY: &str = "connect"; // Rich Presence key that makes a friend "Joinable"

// Current lobby — shared between commands and the callback thread.
pub struct SteamNetState {
  pub lobby: Arc<Mutex<Option<LobbyId>>>,
}
impl SteamNetState {
  pub fn empty() -> Self {
    SteamNetState { lobby: Arc::new(Mutex::new(None)) }
  }
}

// Events pushed to JS. Tagged union mirrored by SteamNet on the JS side.
#[derive(Clone, serde::Serialize)]
#[serde(tag = "kind")]
enum NetEvent {
  #[serde(rename = "message")]
  Message { from: String, data: String },
  #[serde(rename = "peerJoin")]
  PeerJoin {
    #[serde(rename = "steamId")]
    steam_id: String,
  },
  #[serde(rename = "peerLeave")]
  PeerLeave {
    #[serde(rename = "steamId")]
    steam_id: String,
  },
  #[serde(rename = "lobbyEntered")]
  LobbyEntered {
    #[serde(rename = "lobbyId")]
    lobby_id: String,
    #[serde(rename = "self")]
    self_id: String,
    members: Vec<String>,
  },
  #[serde(rename = "joinRequested")]
  JoinRequested {
    #[serde(rename = "lobbyId")]
    lobby_id: String,
  },
  #[serde(rename = "mmResult")]
  MmResult { lobbies: Vec<String> },
}

fn emit(app: &AppHandle, ev: NetEvent) {
  let _ = app.emit(STEAM_NET_EVENT, ev);
}

fn members_of(client: &Client, lobby: LobbyId) -> Vec<String> {
  client
    .matchmaking()
    .lobby_members(lobby)
    .into_iter()
    .map(|id| id.raw().to_string())
    .collect()
}

// Run a callback body so a panic can't unwind across the C run_callbacks frame (UB) or kill the
// pump thread — catch it here. The panic message itself is printed by the default hook.
fn guard<F: FnOnce()>(label: &str, f: F) {
  if std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).is_err() {
    eprintln!("[steam-net] '{label}' panicked (caught — see the panic message above)");
  }
}

// Register Steam callbacks and spawn the shared pump thread (run_callbacks + message drain).
// Must run whenever Steam is available — run_callbacks also drives stats/cloud/RP. The returned
// state is managed by Tauri for the networking commands.
//
// CRITICAL: Steam callbacks fire WHILE run_callbacks() holds the global Steam lock. Doing slow
// work there (Tauri `emit` → webview IPC, or log routed to the webview) starves the
// SteamNetworkingSockets service thread ("service thread waited Nms for lock") and breaks the
// P2P handshake (ClosedByPeer). So callbacks ONLY enqueue events (fast) and use eprintln (fast,
// stderr); the pump emits to JS AFTER run_callbacks, outside the lock window.
pub fn start_pump(app: AppHandle, client: Client, single: SingleClient) -> SteamNetState {
  let lobby: Arc<Mutex<Option<LobbyId>>> = Arc::new(Mutex::new(None));
  let self_id = client.user().steam_id().raw();
  let (tx, rx) = std::sync::mpsc::channel::<NetEvent>();
  // Diagnostics enqueued from inside callbacks (which hold the Steam lock) and printed OUTSIDE it
  // — printing to the captured console is slow on Windows and starves the SDR service thread.
  let (log_tx, log_rx) = std::sync::mpsc::channel::<String>();

  // Lobby membership changes → peerJoin / peerLeave (enqueue only).
  let tx_chat = tx.clone();
  let cb_chat = client.register_callback(move |u: LobbyChatUpdate| guard("LobbyChatUpdate", || {
    let steam_id = u.user_changed.raw().to_string();
    let _ = tx_chat.send(match u.member_state_change {
      ChatMemberStateChange::Entered => NetEvent::PeerJoin { steam_id },
      _ => NetEvent::PeerLeave { steam_id },
    });
  }));

  // Overlay invite / "Join game" → ask JS to join this lobby (enqueue only).
  let tx_join = tx.clone();
  let cb_join = client.register_callback(move |r: GameLobbyJoinRequested| guard("GameLobbyJoinRequested", || {
    let _ = tx_join.send(NetEvent::JoinRequested { lobby_id: r.lobby_steam_id.raw().to_string() });
  }));

  // Steam overlay closed → the user may have just BOUGHT the Radio DLC via the store overlay; tell JS to
  // re-check ownership for a live unlock (steamworks 0.11 has no DlcInstalled callback).
  let overlay_app = app.clone();
  let cb_overlay = client.register_callback(move |o: GameOverlayActivated| guard("GameOverlayActivated", || {
    if !o.active { let _ = overlay_app.emit("radio-recheck-dlc", ()); }
  }));

  let pump_app = app;
  let pump_client = client.clone();
  std::thread::spawn(move || {
    // Keep the callback handles alive for the life of the pump (drop = unregister).
    let _cb_chat = cb_chat;
    let _cb_join = cb_join;
    let _cb_overlay = cb_overlay;
    let nm = pump_client.networking_messages();
    // Accept incoming sessions — ZERO I/O here (runs under the Steam lock): just accept + enqueue
    // a diagnostic. Doing console/IPC work here starves the SDR service thread (ClosedByPeer).
    let req_log = log_tx.clone();
    nm.session_request_callback(move |req| guard("session_request", || {
      // steamworks-rs 0.11 BUG: SessionRequest::accept(self) calls AcceptSessionWithUser, then its
      // Drop immediately CloseSessionWithUser()s the just-accepted session — the peer sees
      // ClosedByPeer (app end code 1001) and no messages flow. Accept via the sys API and
      // mem::forget the request to skip the poisonous Drop. (Forgetting leaks one Arc per accepted
      // session — negligible for 1v1.)
      if let Some(sid) = req.remote().steam_id() {
        unsafe {
          let mut ident: steamworks_sys::SteamNetworkingIdentity = std::mem::zeroed();
          steamworks_sys::SteamAPI_SteamNetworkingIdentity_SetSteamID64(&mut ident, sid.raw());
          let msgs = steamworks_sys::SteamAPI_SteamNetworkingMessages_SteamAPI_v002();
          steamworks_sys::SteamAPI_ISteamNetworkingMessages_AcceptSessionWithUser(msgs, &ident);
        }
        let _ = req_log.send(format!("[steam-net:{self_id}] session request from {} — accepted", sid.raw()));
      }
      std::mem::forget(req);
    }));
    // Session failures: enqueue a diagnostic only (no I/O, no end_reason() — it panics on codes the
    // crate's enum doesn't list, and it tells us nothing useful). A transient first failure is normal.
    let fail_log = log_tx.clone();
    nm.session_failed_callback(move |info| guard("session_failed", || {
      let who = info.identity_remote().and_then(|i| i.steam_id()).map(|s| s.raw().to_string()).unwrap_or_default();
      // The crate's end_reason() panics on codes its (old-SDK) enum doesn't list. NetConnectionInfo
      // is a single-field POD wrapper over sys::SteamNetConnectionInfo_t, so read the raw i32 code.
      let raw: steamworks_sys::SteamNetConnectionInfo_t = unsafe { std::mem::transmute_copy(&info) };
      let _ = fail_log.send(format!("[steam-net:{self_id}] session failed with {who}: end_code={} state={:?}", raw.m_eEndReason, info.state()));
    }));
    let tx_msg = tx;
    loop {
      single.run_callbacks();
      guard("receive", || {
        for msg in nm.receive_messages_on_channel(NET_CHANNEL, 32) {
          if let Some(from) = msg.identity_peer().steam_id() {
            let data = String::from_utf8_lossy(msg.data()).to_string();
            let _ = tx_msg.send(NetEvent::Message { from: from.raw().to_string(), data });
          }
        }
      });
      // Outside the Steam lock window: emit queued events + print diagnostics (both can be slow).
      while let Ok(ev) = rx.try_recv() { emit(&pump_app, ev); }
      while let Ok(line) = log_rx.try_recv() { eprintln!("{line}"); }
      std::thread::sleep(Duration::from_millis(NET_PUMP_MS));
    }
  });

  SteamNetState { lobby }
}

// Current SDR relay network status (e.g. "Ok(Current)" once ready). Diagnostic for P2P setup.
#[tauri::command]
pub fn steam_net_relay_status(state: State<'_, SteamState>) -> String {
  let guard = state.0.lock().unwrap();
  match guard.as_ref() {
    Some(client) => format!("{:?}", client.networking_utils().relay_network_status()),
    None => "no steam".to_string(),
  }
}

// Our own SteamID64 (string) — the synchronous selfId for the JS transport.
#[tauri::command]
pub fn steam_net_self(state: State<'_, SteamState>) -> Option<String> {
  let guard = state.0.lock().unwrap();
  let client = guard.as_ref()?;
  Some(client.user().steam_id().raw().to_string())
}

// Create a 1v1 lobby of the given visibility; on success store it, make it joinable, advertise via
// Rich Presence and emit `lobbyEntered`. Private = friend invites; Public = matchmaking (listed).
fn spawn_create_lobby(app: AppHandle, state: &SteamState, net: &SteamNetState, ty: LobbyType) {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return };
  let client = client.clone();
  let lobby_arc = net.lobby.clone();
  client.clone().matchmaking().create_lobby(ty, LOBBY_MAX_MEMBERS, move |res| {
    let Ok(lobby) = res else { return };
    *lobby_arc.lock().unwrap() = Some(lobby);
    client.matchmaking().set_lobby_joinable(lobby, true);
    let self_id = client.user().steam_id().raw().to_string();
    client.friends().set_rich_presence(RP_CONNECT_KEY, Some(&lobby.raw().to_string()));
    emit(&app, NetEvent::LobbyEntered {
      lobby_id: lobby.raw().to_string(),
      self_id,
      members: members_of(&client, lobby),
    });
  });
}

// Create a Private 1v1 lobby (friend invites).
#[tauri::command]
pub fn steam_net_create_lobby(app: AppHandle, state: State<'_, SteamState>, net: State<'_, SteamNetState>) {
  spawn_create_lobby(app, &state, &net, LobbyType::Private);
}

// Create a Public 1v1 lobby (matchmaking — shows up in request_lobby_list for other searchers).
#[tauri::command]
pub fn steam_mm_host(app: AppHandle, state: State<'_, SteamState>, net: State<'_, SteamNetState>) {
  spawn_create_lobby(app, &state, &net, LobbyType::Public);
}

// Search public matchmaking lobbies (the list is app-scoped → every entry is an 0N35H07 quick-match
// lobby; friend lobbies are Private and never listed). Emits `mmResult` with the lobby ids.
#[tauri::command]
pub fn steam_mm_search(app: AppHandle, state: State<'_, SteamState>) {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return };
  client.matchmaking().request_lobby_list(move |res| {
    let lobbies = res.map(|v| v.into_iter().map(|l| l.raw().to_string()).collect()).unwrap_or_default();
    emit(&app, NetEvent::MmResult { lobbies });
  });
}

// Join a lobby by its LobbyId string (from a `joinRequested` event). On success emit `lobbyEntered`.
#[tauri::command]
pub fn steam_net_join_lobby(app: AppHandle, state: State<'_, SteamState>, net: State<'_, SteamNetState>, lobby_id: String) {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return };
  let Ok(raw) = lobby_id.parse::<u64>() else { return };
  let client = client.clone();
  let lobby_arc = net.lobby.clone();
  let lobby = LobbyId::from_raw(raw);
  client.clone().matchmaking().join_lobby(lobby, move |res| {
    let Ok(lobby) = res else { return };
    *lobby_arc.lock().unwrap() = Some(lobby);
    let self_id = client.user().steam_id().raw().to_string();
    emit(&app, NetEvent::LobbyEntered {
      lobby_id: lobby.raw().to_string(),
      self_id,
      members: members_of(&client, lobby),
    });
  });
}

// Leave the current lobby and clear the "Joinable" Rich Presence.
#[tauri::command]
pub fn steam_net_leave_lobby(state: State<'_, SteamState>, net: State<'_, SteamNetState>) {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return };
  if let Some(lobby) = net.lobby.lock().unwrap().take() {
    client.matchmaking().leave_lobby(lobby);
  }
  client.friends().set_rich_presence(RP_CONNECT_KEY, None);
}

// Current lobby members' SteamID64 (JS filters out self).
#[tauri::command]
pub fn steam_net_members(state: State<'_, SteamState>, net: State<'_, SteamNetState>) -> Vec<String> {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return Vec::new() };
  match *net.lobby.lock().unwrap() {
    Some(lobby) => members_of(client, lobby),
    None => Vec::new(),
  }
}

// Send a reliable message to a peer by SteamID64. Returns false without Steam / on error.
#[tauri::command]
pub fn steam_net_send(state: State<'_, SteamState>, to: String, data: String) -> bool {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return false };
  let Ok(raw) = to.parse::<u64>() else { return false };
  let identity = NetworkingIdentity::new_steam_id(SteamId::from_raw(raw));
  client
    .networking_messages()
    .send_message_to_user(identity, SendFlags::RELIABLE, data.as_bytes(), NET_CHANNEL)
    .is_ok()
}

// Open the Steam overlay invite dialog for the current lobby.
#[tauri::command]
pub fn steam_net_invite(state: State<'_, SteamState>, net: State<'_, SteamNetState>) {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return };
  if let Some(lobby) = *net.lobby.lock().unwrap() {
    client.friends().activate_invite_dialog(lobby);
  }
}

#[derive(serde::Serialize)]
pub struct SteamFriendDto {
  pub id: String, // SteamID64 as a string
  pub name: String,
  pub online: bool,
}

// Immediate friends, for the in-game friend picker. Online first, then by name.
#[tauri::command]
pub fn steam_friends_list(state: State<'_, SteamState>) -> Vec<SteamFriendDto> {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return Vec::new() };
  let mut list: Vec<SteamFriendDto> = client
    .friends()
    .get_friends(FriendFlags::IMMEDIATE)
    .into_iter()
    .map(|f| SteamFriendDto {
      id: f.id().raw().to_string(),
      name: f.name(),
      online: !matches!(f.state(), FriendState::Offline),
    })
    .collect();
  list.sort_by(|a, b| b.online.cmp(&a.online).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
  list
}

// Invite a specific friend to the current lobby (Steam sends them an invite → on accept they get a
// GameLobbyJoinRequested → join). No-op without a current lobby. InviteUserToLobby isn't exposed by
// the crate, so go through sys (a lobby only exists when Steam is up, so the call is safe).
#[tauri::command]
pub fn steam_invite_to_lobby(net: State<'_, SteamNetState>, friend_id: String) -> bool {
  let Ok(invitee) = friend_id.parse::<u64>() else { return false };
  let Some(lobby) = *net.lobby.lock().unwrap() else { return false };
  unsafe {
    let mm = steamworks_sys::SteamAPI_SteamMatchmaking_v009();
    steamworks_sys::SteamAPI_ISteamMatchmaking_InviteUserToLobby(mm, lobby.raw(), invitee)
  }
}
