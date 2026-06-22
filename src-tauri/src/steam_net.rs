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
  ChatMemberStateChange, Client, GameLobbyJoinRequested, LobbyChatUpdate, LobbyId, LobbyType,
  SingleClient, SteamId,
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

// Register Steam callbacks and spawn the shared pump thread (run_callbacks + message drain).
// Must run whenever Steam is available — run_callbacks also drives stats/cloud/RP. The returned
// state is managed by Tauri for the networking commands.
pub fn start_pump(app: AppHandle, client: Client, single: SingleClient) -> SteamNetState {
  let lobby: Arc<Mutex<Option<LobbyId>>> = Arc::new(Mutex::new(None));

  // Lobby membership changes → peerJoin / peerLeave.
  let chat_app = app.clone();
  let cb_chat = client.register_callback(move |u: LobbyChatUpdate| {
    let steam_id = u.user_changed.raw().to_string();
    match u.member_state_change {
      ChatMemberStateChange::Entered => emit(&chat_app, NetEvent::PeerJoin { steam_id }),
      _ => emit(&chat_app, NetEvent::PeerLeave { steam_id }),
    }
  });

  // Overlay invite / "Join game" → ask JS to join this lobby.
  let join_app = app.clone();
  let cb_join = client.register_callback(move |r: GameLobbyJoinRequested| {
    emit(&join_app, NetEvent::JoinRequested { lobby_id: r.lobby_steam_id.raw().to_string() });
  });

  let pump_app = app;
  let pump_client = client.clone();
  std::thread::spawn(move || {
    // Keep the callback handles alive for the life of the pump (drop = unregister).
    let _cb_chat = cb_chat;
    let _cb_join = cb_join;
    let nm = pump_client.networking_messages();
    // Accept incoming sessions (the lobby flow gates who can reach us; 1v1).
    nm.session_request_callback(|req| req.accept());
    loop {
      single.run_callbacks();
      for msg in nm.receive_messages_on_channel(NET_CHANNEL, 32) {
        let peer = msg.identity_peer();
        let data = String::from_utf8_lossy(msg.data()).to_string();
        match peer.steam_id() {
          Some(from) => {
            log::info!("[steam-net] recv from {} ({} bytes)", from.raw(), msg.data().len());
            emit(&pump_app, NetEvent::Message { from: from.raw().to_string(), data });
          }
          // Shouldn't happen for SteamID-addressed messages; log so we can see if it does.
          None => log::warn!("[steam-net] recv from non-steam identity {}: {:?}", peer.debug_string(), data),
        }
      }
      std::thread::sleep(Duration::from_millis(NET_PUMP_MS));
    }
  });

  SteamNetState { lobby }
}

// Our own SteamID64 (string) — the synchronous selfId for the JS transport.
#[tauri::command]
pub fn steam_net_self(state: State<'_, SteamState>) -> Option<String> {
  let guard = state.0.lock().unwrap();
  let client = guard.as_ref()?;
  Some(client.user().steam_id().raw().to_string())
}

// Create a Private 1v1 lobby; on success store it, make it joinable, advertise via Rich
// Presence and emit `lobbyEntered`.
#[tauri::command]
pub fn steam_net_create_lobby(app: AppHandle, state: State<'_, SteamState>, net: State<'_, SteamNetState>) {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return };
  let client = client.clone();
  let lobby_arc = net.lobby.clone();
  client.clone().matchmaking().create_lobby(LobbyType::Private, LOBBY_MAX_MEMBERS, move |res| {
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
  let res = client
    .networking_messages()
    .send_message_to_user(identity, SendFlags::RELIABLE, data.as_bytes(), NET_CHANNEL);
  match &res {
    Ok(()) => log::info!("[steam-net] send to {} ok ({} bytes)", raw, data.len()),
    Err(e) => log::warn!("[steam-net] send to {} FAILED: {:?}", raw, e),
  }
  res.is_ok()
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
