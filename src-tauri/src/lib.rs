// Разовая чистка залипшего service worker в WebView2 при обновлении (только Windows).
//
// Десктоп-сборки до 0.5.6 включали кэширующий PWA service worker. В WebView2 он регистрируется
// персистентно (данные привязаны к идентификатору приложения) и после апдейта продолжает отдавать
// СТАРЫЙ закэшированный фронтенд — приложение «залипает» на прошлой версии. Изнутри вебвью это не
// лечится: пока старый SW рулит страницей, новый JS (в т.ч. самоуничтожение SW) не исполняется.
// Поэтому чистим снаружи — нативно, ДО старта WebView2, пока он не залочил свои файлы.
//
// Удаляем ТОЛЬКО подпапку `Service Worker` профиля WebView2 (регистрация SW + его CacheStorage).
// `Local Storage` (профиль/внешность, host-key, выбор сети, кэш релеев) не трогаем — настройки целы.
#[cfg(windows)]
fn purge_stale_service_worker() {
  use std::path::Path;

  // Идентификатор приложения из tauri.conf.json — каталог данных WebView2 на Windows:
  // %LOCALAPPDATA%\<identifier>\EBWebView (см. $APPLOCALDATA/EBWebView в доках Tauri).
  const APP_IDENTIFIER: &str = "com.oneshot.game";
  const PURGE_MARKER: &str = ".sw_purge_version";

  let Ok(local_app_data) = std::env::var("LOCALAPPDATA") else { return };
  let base = Path::new(&local_app_data).join(APP_IDENTIFIER);

  // Гейт по версии: чистим один раз после каждого обновления, а не каждый запуск.
  let marker = base.join(PURGE_MARKER);
  let current_version = env!("CARGO_PKG_VERSION");
  if std::fs::read_to_string(&marker).ok().as_deref() == Some(current_version) {
    return;
  }

  // Удаляем регистрацию SW и его кэш. Нет папки → тихий no-op (ничего не ломаем).
  let service_worker_dir = base.join("EBWebView").join("Default").join("Service Worker");
  let _ = std::fs::remove_dir_all(&service_worker_dir);

  // Помечаем версию, на которой почистили (создаём base, если его ещё нет).
  let _ = std::fs::create_dir_all(&base);
  let _ = std::fs::write(&marker, current_version);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // ДО создания окна/WebView2: пока вебвью не поднялся, его файлы не залочены.
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
