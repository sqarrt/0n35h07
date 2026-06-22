use std::sync::Mutex;
use std::time::Duration;
use steamworks::{AppId, Client};
use tauri::State;

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

// Pump interval for Steam callbacks. ~20 Hz is plenty for lobby/stats traffic and
// keeps the thread idle otherwise.
const CALLBACK_INTERVAL_MS: u64 = 50;

// Initialize Steam and spawn the callback pump. Soft-fails to None so the app still
// launches without Steam (dev, browser-equivalent, unowned copies).
pub fn init_steam(app_id: u32) -> Option<Client> {
  match Client::init_app(AppId(app_id)) {
    Ok((client, single)) => {
      // Load the user's current stats/achievements so set()/get() act on real state.
      client.user_stats().request_current_stats();
      std::thread::spawn(move || loop {
        single.run_callbacks();
        std::thread::sleep(Duration::from_millis(CALLBACK_INTERVAL_MS));
      });
      Some(client)
    }
    Err(err) => {
      log::warn!("Steam init failed (running without Steam): {err}");
      None
    }
  }
}
