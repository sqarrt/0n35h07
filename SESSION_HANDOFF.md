# Передача сессии — OneShot: перенос web → Godot (обновлено 13.09.2026, поздний вечер, Claude Code, WSL)

## 1. Задача

Портировать web-версию игры (эталон в `web-reference/`, React/Three.js) на Godot 4.7.1 с **полным сохранением визуала
и функционала 1:1**. Работать **автономно**, без участия пользователя. На **каждом этапе** проверки паритета
формировать **новый HTML-отчёт** с найденными расхождениями и скриншотами-сравнением.

Правила пользователя:
- Писать пользователю **только по-русски**.
- Отчёты **НЕ публиковать** (никаких Artifact) — только сохранять HTML локально в `test-results/parity-reports/`.
  Каждый отчёт новый, прежние не перезаписывать (генератор сам кладёт вывод в папку с отметкой времени).
- Web-эталон снимать **только на реальном GPU** (Windows), не SwiftShader/Mesa.
- В `web-reference/` **можно добавлять отладочные хуки** (`window.__debug*`) ради кадров сверки.
- ctx7 — через MCP (`mcp__plugin_context7_context7__*`); `npx ctx7` в песочнице падает.
- GitFlow: фича-ветка от `release_2.0.0` → мерж в `release_2.0.0` (сам); в master не коммитить, push не делать.
- TDD, GUT после каждого изменения, без магических чисел, SOLID/DRY. Спеки/планы — `docs/superpowers/` (git-ignore).

## 2. Как работать (WSL)

- Тесты: `scripts/godot.sh --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit`
  (песочница off; после новых `class_name` сначала `scripts/godot.sh --headless --path . --import`, ~1 мин).
  Не писать новые файлы в `tests/`/`nodes/` пока идёт импорт/GUT; не гонять Windows-захват Godot одновременно с GUT.
- Godot-кадры на реальном GPU (Windows-бинарь):
  `cmd.exe /c "D:\Downloads\Godot_v4.7.1-stable_win64.exe --path C:\Users\Home\PycharmProjects\OneShot --resolution 1280x720 --fixed-fps 60 -s tools/screenshot.gd -- res://scenes/arena_test.tscn res://maps/os_arena.json res://test-results/<dir>/<name>.png <кадр> <режим> [мс матча]"`
  Режимы: `passive-bot`, `reference-camera`, `hud-banner[-<kind>]`, `hud-names-<tier>`, `hud-ghost`, `third-person`,
  `profile`, `profile-double`, `profile:<режим>` (профиль PARITY7 `#fa4` + бот EX82R в памяти). Кадр ≥40; живой матч — 300.
- Web-кадры: Vite из WSL `cd web-reference && node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`,
  затем `cmd.exe /c "cd /d C:\Users\Home\PycharmProjects\OneShot\web-reference && node scripts\<скрипт>.mjs ..\test-results\<dir>"`
  (карта: `set PARITY_MAP=os_pool_day&& ...`). Скрипты: `parity-capture.mjs` (меню/лобби/игра/попадание/баннер/отсчёт/конец),
  `parity-capture-streak.mjs`, `parity-capture-camera.mjs`, `parity-capture-profile.mjs`, пробник
  `parity-probe-fx-region.mjs`; общий код — `parity-lib.mjs` (`enterLiveMatch(page, base, map, onStage, {profile, botName})`).
  Хуки web: `__debugAnnounce(kind)`, `__debugStreak(id,n)`, `__debugPlayerColor(id)`, `__debugForceEnd`, …
- Замеры: `python3 tools/parity/measure.py [--hud] a.png b.png`; вырезки: `python3 tools/parity/crop.py in out x y w h [scale]`.
- Отчёт: спека `tools/parity/stages/<id>.json` → `python3 tools/parity/report.py <spec>` → открыть HTML локально.

## 3. Сделано (всё смержено в `release_2.0.0`, GUT 262/262)

| Слайс | Суть |
|---|---|
| Сеть: victim-judged hit claims | NetSync/NetSession, 16 тестов (к матчу НЕ подключено) |
| Инструменты сверки | report.py, parity-capture*.mjs (отказ на SwiftShader), crop.py |
| Карта G7/G8/G10, часы G9, пол/свет G6+W1, сетка B1 | спавны, коллизии, MatchClock/результат, FloorGrid/MapLights, BlockGrid |
| HUD H1, эффекты H2 | верхняя строка, прицел, скобки, рывок; отсчёт, баннер, ghost, виньетки, вспышки |
| H3 эффекты серий + размытые свечения | `StreakFx`/`CssTiming`/`CssShadow`, `GlowText` (гауссово размытие через SubViewport), `EffectText`, шейдеры glow_*/text_turbulence; длительность по умолчанию 3 мин |
| CAM1/G12 камера и управление | `CameraModel`, `HumanController`: ЛКМ/ПКМ(щит)/Shift/V события, чувств. 0.002×0.15, наклон ±90°, тряска, FOV ghost, третье лицо, прицел лучом из камеры |
| P1 профили игроков | `PlayerProfile`/`ModelNames`/`BotAppearance`/`Roster`/`ProfileStore`; ники и цвета в HUD, баннере, результате; фиксы размеров текста и области фильтра серий |

Отчёты: `test-results/parity-reports/` (baseline … hud-effects, streak-text, camera-view, player-profiles).
Замечания пользователя (свечения обводкой, рамка ghost-полос) — **закрыты** в H3.

## 4. Текущее состояние

Ветка **`feature/godot-skins`** (от `release_2.0.0`, слайс G11). Спека: `docs/superpowers/specs/2026-09-13-godot-skins-design.md`
(все web-скины прочитаны и выписаны: 3 модели шара + рисунок, 3 луча, 3 замаха, 3 респавна, 3 рывка, 3 щита).

## 5. Что ещё осталось (бэклог паритета)

- **G11 скины** (следующий): шар/кольцо/рисунок, лучи, замахи, респавны (взрыв частиц, призрак), следы рывка, щиты;
  overheat-виньетка и молнии; FX импакта.
- **Звук** (музыка, SFX) и **AudioBar** (визуализатор, `audioViz` вкл. по умолчанию); StatsOverlay (FPS/скорость).
- **Тема интерфейса**: кнопки (`Button variant=primary`), экран результата E2 (кнопка/высота колонки).
- **Меню M1–M8**: 3D-фон с шаром, логотип 0N35H07, экраны Внешность/Настройки/Об игре, i18n (10 локалей, `locale`
  в профиле), заставка-предупреждение, пауза в стиле web; настройка `defaultView` fp/tp.
- **Лобби L1–L6**: режимы DUEL/BATTLE/WAR, места, боты (ник/сложность), карты мультивыбор, длительность 3/5/10,
  код комнаты; карта `os_test`; ready-оверлей (фаза ready).
- **Сеть в матче**: NetSync к MatchNode, транспорт (ENet/WebRTC/Steam), RoomSession; **Steam** (GodotSteam, имя из Steam);
  **радио** (WebView + Strudel); редактор карт; трейлер; неймплейты 2v2/FFA.

## 6. Грабли (не наступать повторно)

- `set_anchors_preset` у полноэкранного Control оставляет размер 0×0 → только `set_anchors_and_offsets_preset`;
  тесты раскладки — в `SubViewport` 1280×720 (headless root 64×64).
- `Label.get_minimum_size()` сразу после `add_theme_font_override` — ещё со старым шрифтом → `minimum_size_changed`.
- Прозрачный SubViewport хранит premultiplied-цвет; выводить его `render_mode blend_premul_alpha`.
- Область SVG-фильтра серий в Chrome не обрезает свечение `text-shadow` (замерено пробником) → `StreakFx.filter_region`.
- `JSON.parse_string` на мусоре пишет ошибку движка (GUT валит тест) → `JSON.new().parse()`.
- Автозагрузки получают `_ready` после `_initialize` инструмента `-s` → не перетирать заданное инструментом.
- SwiftShader теряет крутые GL_LINES и скин луча; Mesa llvmpipe рисует фантомную плиту → web только на Windows GPU.
- geo.json из three.js: лицевые грани против часовой; Godot — по часовой (`GeoLoader._godot_winding`).
- JS `Math.round(-0.5) = 0`, GDScript `round(-0.5) = -1` → `floori(v + 0.5)`.
- В web нижние скобки щита на 4px выше из-за строчного `<svg>` (`WEB_BASELINE_GAP`).
- `import measure` создаёт `tools/parity/__pycache__` (игнорируется `.gitignore`); не `git add tools` целиком без проверки.
- `TMPDIR` при выключенной песочнице пуст → логи писать в scratchpad по полному пути.
- Предупреждение `could not lock config file .git/config` при `git branch -d` безвредно (песочница).
- В корне появляются char-device файлы `.bashrc`/`.gitconfig`/`.vscode` от песочницы — не коммитить.
- Playwright в WSL: браузер `~/.cache/ms-playwright/chromium_headless_shell-1234/...` через `executablePath`.
