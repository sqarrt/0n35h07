# Tauri wrapper (experimental)

Desktop build of `0N35H07` via [Tauri 2](https://v2.tauri.app/) — uses the system webview (WebKitGTK on
Linux, WebView2 on Windows) instead of bundling Chromium. The wrapper is clean: the frontend (`../dist`) is
embedded as-is, `@tauri-apps/api` is not used, and the project's `package.json` is untouched.

## Building on Linux (from WSL)

One-time toolchain setup:

```bash
# Node >=20 (Vite 8) — via nvm, no sudo
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Tauri system dependencies (Ubuntu/Debian)
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config

# Tauri CLI (isolated binary, does not touch node_modules)
cargo install tauri-cli --version "^2.0" --locked
```

The build itself:

```bash
npm run build                         # build the frontend into ../dist (Windows npm is fine too)
cargo tauri build --bundles deb       # binary + .deb
```

> Tip: put cargo's target directory on the Linux FS, otherwise compiling on `/mnt/c` (9p) is very slow:
> `export CARGO_TARGET_DIR="$HOME/.cache/oneshot-tauri-target"`.

Output: the `release/app` binary (~15 MB, with the frontend embedded) and
`release/bundle/deb/0N35H07_0.5.0_amd64.deb` (~8 MB).

## Windows build

Done on Windows with Rust (MSVC) installed — the webview there is WebView2 (Edge). It does not
cross-compile directly from WSL; that's a separate step in a Windows environment.

## Icons

Generated from `../build/icon.png` (1024×1024) via `cargo tauri icon ../build/icon.png`.
