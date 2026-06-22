// One-time cleanup of a stuck WebView2 service worker on update (Windows only).
//
// Desktop builds before 0.5.6 shipped a caching PWA service worker. In WebView2 it registers
// persistently (data is tied to the app identifier) and after an update keeps serving the OLD
// cached frontend — the app "gets stuck" on the previous version. This can't be fixed from inside
// the webview: while the old SW runs the page, the new JS (including the SW's self-destruction) never
// executes. So we clean up from the outside — natively, BEFORE WebView2 starts, while it hasn't
// locked its files.
//
// We remove ONLY the WebView2 profile's `Service Worker` subfolder (SW registration + its CacheStorage).
// `Local Storage` (profile/appearance, host-key, network choice, relay cache) is left untouched — settings stay intact.
#[cfg(windows)]
fn purge_stale_service_worker() {
  use std::path::Path;

  // App identifier from tauri.conf.json — WebView2 data directory on Windows:
  // %LOCALAPPDATA%\<identifier>\EBWebView (see $APPLOCALDATA/EBWebView in the Tauri docs).
  const APP_IDENTIFIER: &str = "com.oneshot.game";
  const PURGE_MARKER: &str = ".sw_purge_version";

  let Ok(local_app_data) = std::env::var("LOCALAPPDATA") else { return };
  let base = Path::new(&local_app_data).join(APP_IDENTIFIER);

  // Version gate: clean up once after each update, not on every launch.
  let marker = base.join(PURGE_MARKER);
  let current_version = env!("CARGO_PKG_VERSION");
  if std::fs::read_to_string(&marker).ok().as_deref() == Some(current_version) {
    return;
  }

  // Remove the SW registration and its cache. No folder → silent no-op (nothing breaks).
  let service_worker_dir = base.join("EBWebView").join("Default").join("Service Worker");
  let _ = std::fs::remove_dir_all(&service_worker_dir);

  // Mark the version we cleaned at (create base if it doesn't exist yet).
  let _ = std::fs::create_dir_all(&base);
  let _ = std::fs::write(&marker, current_version);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // BEFORE creating the window/WebView2: while the webview isn't up, its files aren't locked.
  #[cfg(windows)]
  purge_stale_service_worker();

  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
