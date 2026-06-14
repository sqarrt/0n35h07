# Tauri-обёртка (эксперимент)

Десктоп-сборка `0N35H07` через [Tauri 2](https://v2.tauri.app/) — системный webview (WebKitGTK на Linux,
WebView2 на Windows) вместо бандла Chromium. Обёртка чистая: фронт (`../dist`) встраивается как есть,
`@tauri-apps/api` не подключён, `package.json` проекта не тронут.

## Сборка под Linux (из WSL)

Требуется один раз поставить тулчейн:

```bash
# Node ≥20 (Vite 8) — через nvm, без sudo
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Системные зависимости Tauri (Ubuntu/Debian)
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config

# Tauri CLI (изолированный бинарь, node_modules не трогает)
cargo install tauri-cli --version "^2.0" --locked
```

Сама сборка:

```bash
npm run build                         # собрать фронт в ../dist (можно и Windows-npm)
cargo tauri build --bundles deb       # бинарь + .deb
```

> Совет: вынеси target-каталог cargo на Linux-ФС, иначе компиляция на `/mnt/c` (9p) очень медленная:
> `export CARGO_TARGET_DIR="$HOME/.cache/oneshot-tauri-target"`.

Результат: бинарь `release/app` (~15 MB, с вшитым фронтом) и `release/bundle/deb/0N35H07_0.5.0_amd64.deb` (~8 MB).

## Windows-сборка

Делается на Windows с установленным Rust (MSVC) — webview там WebView2 (Edge). Из WSL напрямую не
кросс-компилируется; отдельный шаг уже в Windows-окружении.

## Иконки

Сгенерированы из `../build/icon.png` (1024×1024) командой `cargo tauri icon ../build/icon.png`.
