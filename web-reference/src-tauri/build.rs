use std::path::PathBuf;

fn main() {
  tauri_build::build();
  copy_steam_runtime();
}

// The steamworks crate emits the Steam runtime lib (steam_api64.dll / libsteam_api.so /
// libsteam_api.dylib) into steamworks-sys' OUT dir but does NOT place it next to the final
// binary, so the app can't load it at run time. Copy it beside the executable for every build
// (dev, run, release) — cross-platform. CI assembles the depot the same way.
fn copy_steam_runtime() {
  let Some(out_dir) = std::env::var_os("OUT_DIR").map(PathBuf::from) else { return };
  // OUT_DIR = target/<profile>/build/app-<hash>/out
  //           nth(2) -> target/<profile>/build      nth(3) -> target/<profile> (next to the exe)
  let mut ancestors = out_dir.ancestors();
  let build_dir = ancestors.nth(2).map(|p| p.to_path_buf());
  let profile_dir = ancestors.next().map(|p| p.to_path_buf());
  let (Some(build_dir), Some(profile_dir)) = (build_dir, profile_dir) else { return };

  const LIBS: [&str; 3] = ["steam_api64.dll", "libsteam_api.so", "libsteam_api.dylib"];
  let Ok(entries) = std::fs::read_dir(&build_dir) else { return };
  for entry in entries.flatten() {
    if !entry.file_name().to_string_lossy().starts_with("steamworks-sys-") {
      continue;
    }
    let lib_out = entry.path().join("out");
    for lib in LIBS {
      let src = lib_out.join(lib);
      if src.exists() {
        let _ = std::fs::copy(&src, profile_dir.join(lib));
      }
    }
  }
}
