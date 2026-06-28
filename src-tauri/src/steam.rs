use std::io::{Read, Write};
use std::sync::Mutex;
use steamworks::{AppId, Client, OverlayToStoreFlag, SingleClient};
use tauri::State;

/// The Radio is sold as a DLC; ownership unlocks unlimited generation/saves (else a free daily trial applies).
const RADIO_DLC_APPID: u32 = 4904970;

// The persistent Steam client handle (Clone + Send + Sync), or None if init failed
// (Steam not running / game not owned / no steam_appid.txt in dev).
pub struct SteamState(pub Mutex<Option<Client>>);

#[derive(serde::Serialize)]
pub struct SteamUserDto {
  pub id: String, // SteamID64 as a string — exceeds JS Number safe range
  pub name: String,
}

#[tauri::command]
pub fn steam_available(state: State<'_, SteamState>) -> bool {
  state.0.lock().unwrap().is_some()
}

#[tauri::command]
pub fn steam_user(state: State<'_, SteamState>) -> Option<SteamUserDto> {
  let guard = state.0.lock().unwrap();
  let client = guard.as_ref()?;
  Some(SteamUserDto {
    id: client.user().steam_id().raw().to_string(),
    name: client.friends().name(),
  })
}

// Unlock an achievement by its API name (defined in the Steamworks partner portal) and flush
// to Steam. Returns false if Steam is unavailable or the call failed. Steam's SetAchievement is
// idempotent, so re-unlocking an already-unlocked achievement is harmless.
#[tauri::command]
pub fn steam_unlock_achievement(state: State<'_, SteamState>, name: String) -> bool {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return false };
  let stats = client.user_stats();
  if stats.achievement(&name).set().is_err() {
    return false;
  }
  stats.store_stats().is_ok()
}

// Set (or clear, with value = None) a Steam Rich Presence key — shown in the friends list /
// the user's profile. The `steam_display` key takes a localization token defined in the partner
// portal. No-op without Steam. Returns whether the call succeeded.
#[tauri::command]
pub fn steam_set_rich_presence(state: State<'_, SteamState>, key: String, value: Option<String>) -> bool {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return false };
  client.friends().set_rich_presence(&key, value.as_deref())
}

// --- Steam Cloud (Remote Storage) ---
// One named file per blob; the game decides the format. All three soft-fail without Steam.

// Read a cloud file as a UTF-8 string. None if Steam is unavailable, the file is missing, or
// the bytes aren't valid UTF-8.
#[tauri::command]
pub fn steam_cloud_read(state: State<'_, SteamState>, name: String) -> Option<String> {
  let guard = state.0.lock().unwrap();
  let client = guard.as_ref()?;
  let file = client.remote_storage().file(&name);
  if !file.exists() {
    return None;
  }
  let mut buf = String::new();
  file.read().read_to_string(&mut buf).ok()?;
  Some(buf)
}

// Write a cloud file (overwrites). Returns false without Steam or on a write error. The write
// stream flushes/closes on drop.
#[tauri::command]
pub fn steam_cloud_write(state: State<'_, SteamState>, name: String, data: String) -> bool {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return false };
  let mut writer = client.remote_storage().file(&name).write();
  writer.write_all(data.as_bytes()).is_ok()
}

// Delete a cloud file (locally and remotely). Returns whether a file was actually removed.
#[tauri::command]
pub fn steam_cloud_delete(state: State<'_, SteamState>, name: String) -> bool {
  let guard = state.0.lock().unwrap();
  let Some(client) = guard.as_ref() else { return false };
  client.remote_storage().file(&name).delete()
}

// --- Radio DLC entitlement ---

// True if the current user owns the Radio DLC (Steam caches licenses, so this works offline once known).
// false without Steam → the free daily trial applies.
#[tauri::command]
pub fn radio_dlc_owned(state: State<'_, SteamState>) -> bool {
  let guard = state.0.lock().unwrap();
  match guard.as_ref() {
    Some(client) => client.apps().is_subscribed_app(AppId(RADIO_DLC_APPID)),
    None => false,
  }
}

// Open the Steam overlay on the Radio DLC store page (so the user can buy it). No-op without Steam/overlay.
#[tauri::command]
pub fn open_radio_store(state: State<'_, SteamState>) {
  if let Some(client) = state.0.lock().unwrap().as_ref() {
    client
      .friends()
      .activate_game_overlay_to_store(AppId(RADIO_DLC_APPID), OverlayToStoreFlag::None);
  }
}

// Initialize Steam. Soft-fails to None so the app still launches without Steam (dev,
// browser-equivalent, unowned copies). The callback pump is spawned by steam_net::start_pump
// (run_callbacks drives stats/cloud/RP AND networking), so the SingleClient is returned here.
pub fn init_steam(app_id: u32) -> Option<(Client, SingleClient)> {
  match Client::init_app(AppId(app_id)) {
    Ok((client, single)) => {
      // Load the user's current stats/achievements so set()/get() act on real state.
      client.user_stats().request_current_stats();
      // Enable Steam Cloud for this app (also gated by the partner-portal cloud setting).
      client.remote_storage().set_cloud_enabled_for_app(true);
      // Bootstrap SDR relay access — required for NetworkingMessages P2P to establish a session
      // (without it the first session never comes up and messages are silently dropped). Takes a
      // few seconds to become ready after launch.
      client.networking_utils().init_relay_network_access();
      Some((client, single))
    }
    Err(err) => {
      log::warn!("Steam init failed (running without Steam): {err}");
      None
    }
  }
}
