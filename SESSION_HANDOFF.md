# Передача сессии — OneShot: перенос web → Godot (обновлено 13.09.2026, Claude Code, WSL)

## 1. Задача

Портировать web-версию игры (эталон в `web-reference/`, React/Three.js) на Godot 4.7.1 с **полным сохранением визуала
и функционала 1:1**. Работать **автономно**, без участия пользователя. На **каждом этапе** проверки паритета
формировать **новый HTML-отчёт** с найденными расхождениями и скриншотами-сравнением.

Правила пользователя:
- Писать пользователю **только по-русски**.
- Отчёты **НЕ публиковать** (никаких Artifact) — только сохранять HTML локально в `test-results/parity-reports/`.
  Каждый отчёт новый, прежние не перезаписывать (генератор сам кладёт вывод в папку с отметкой времени).
- Web-эталон снимать **только на реальном GPU** (Windows), не SwiftShader/Mesa.
- GitFlow: фича-ветка от `release_2.0.0` → мерж в `release_2.0.0` (сам); в master не коммитить, push не делать.
- TDD, GUT после каждого изменения, без магических чисел, SOLID/DRY. Спеки/планы — `docs/superpowers/` (git-ignore).

## 2. Как работать (WSL)

- Тесты: `scripts/godot.sh --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit`
  (песочница off; после новых `class_name` сначала `scripts/godot.sh --headless --path . --import`, ~1 мин).
  Не писать новые файлы в `tests/`/`nodes/` пока идёт импорт/GUT — попадут в сканирование.
- Godot-кадры на реальном GPU (Windows-бинарь):
  `cmd.exe /c "D:\Downloads\Godot_v4.7.1-stable_win64.exe --path C:\Users\Home\PycharmProjects\OneShot --resolution 1280x720 --fixed-fps 60 -s tools/screenshot.gd -- res://scenes/arena_test.tscn res://maps/os_arena.json res://test-results/<dir>/<name>.png <кадр> <режим> [мс матча]"`
  Режимы: `passive-bot`, `reference-camera`, `hud-banner`, `hud-ghost`. Кадр ≥40 (ранние кадры искажены стартом окна).
- Web-кадры: Vite из WSL `cd web-reference && node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`,
  затем `cmd.exe /c "cd /d C:\Users\Home\PycharmProjects\OneShot\web-reference && node scripts\parity-capture.mjs ..\test-results\<dir>"`
  (карта: `cmd.exe /c "set PARITY_MAP=os_pool_day&& cd /d ... && node ..."`). Снимает меню, лобби, игру, попадание,
  баннер, отсчёт, конец матча; пишет `web-runtime.json` с рендерером.
- Замер пикселей: `python3 tools/parity/measure.py [--hud] a.png b.png`.
- Отчёт: спека `tools/parity/stages/<id>.json` → `python3 tools/parity/report.py <spec>` → открыть HTML локально.

## 3. Сделано (всё смержено в `release_2.0.0`, GUT 208/208 на момент мержа H2)

| Слайс | Мерж | Суть |
|---|---|---|
| Сеть: victim-judged hit claims | d3411e3 | NetSync/NetSession, 16 тестов (к матчу НЕ подключено) |
| Инструменты сверки, GPU-захват | 3b4bcb0 | report.py, parity-capture.mjs (отказ на SwiftShader) |
| Карта в матче G7/G8/G10 | 59b6051 | нет TargetDummy, спавны из raw.spawns, движение по geo.collider + границы, луч по raycast-группам |
| Часы и конец матча G9 | a2c4be7 | MatchClock, фаза ENDED, MatchResult, MatchEndedOverlay, таймер HUD |
| Пол и свет G6 + W1 | a17522f | FloorGrid, MapLights (Linear, π-перевод), MSAA 4x, **разворот намотки geo.json** |
| Сетка ячеек B1 | b50e077 | BlockGrid/BlockGridMesh по showBlockGrid (Pool) |
| Ядро HUD H1 | 77be34a | UiFont (Share Tech Mono), HudTopBar, HudCrosshair, HudShieldBrackets, HudDashBars (попиксельно = web) |
| Эффекты HUD H2 | 2b976f2 | HudCountdown, HudStreakBanner (серии любого игрока), HudGhostIndicator, HudOverlayFx + шейдер виньеток, вспышки |

Локальные отчёты: `test-results/parity-reports/` (baseline, map-correctness, match-clock-*, floor-light-*,
block-grid-*, hud-core-*, hud-effects-*). Кадры: `test-results/parity-gpu*`.

## 4. Текущее состояние (НЕ закоммичено)

Ветка **`feature/godot-streak-text`** (от release_2.0.0, коммитов ещё нет, кроме унаследованных). Незакоммичено:
- `sim/css_timing.gd` (новый: cubic-bezier, пресеты, выборка ключевых кадров, steps) — не тестировался.
- `sim/streak_fx.gd` (новый: таблица стилей `.fx--*`, ключи ks-flick/jitter/burn/throb/crack/tick/gA/gB, scramble).
- `tests/unit/test_streak_fx.gd` (новый, был красным до реализации).
- `sim/hud_model.gd`: `css_ease_out` переведён на `CssTiming`; **надо удалить** ставшие ненужными константы
  `EASE_OUT_X2` и `BEZIER_STEPS`.
Следующие шаги: удалить константы → `--import` → GUT → коммит → задача 2 плана H3 (узел `EffectText`) →
задача 3 (подключить к баннеру и именам в верхней строке) → кадры → новый HTML-отчёт → мерж.
Спека/план H3: `docs/superpowers/specs|plans/2026-09-13-godot-streak-text*`.

## 5. Замечания пользователя — исправить в первую очередь

1. **Свечение цифр отсчёта сделано обводкой — неверно.** В web `text-shadow: 0 0 40px rgba(68,170,255,0.6)` —
   мягкое размытое свечение. Тени `Label` в Godot не размываются, `shadow_outline_size` даёт контур. Нужно настоящее
   размытие (например, текст в `SubViewport`/`BackBufferCopy` + gaussian-шейдер, или canvas_item-шейдер с
   многоточечной выборкой альфы). Та же проблема: заголовок экрана результата (E1, 26px свечение), подпись
   ghost-фазы (8px), будущие эффекты серий H3 (12–32px свечения).
2. **Полоса ghost-фазы не как в игре.** Web (`RespawnOverlay.tsx`): полосы `#9cf` 6px, `box-shadow: 0 0 10px #9cf` —
   мягкое свечение, в скриншоте пользователя тонкие светящиеся линии у верхнего и нижнего края. У меня вокруг полосы
   залитый полупрозрачный прямоугольник (выглядит как рамка). Нужно плавное затухание свечения (градиент/шейдер).
   Сверить положение (21px от края) по кадру пользователя; также сверить силу виньетки ghost-фазы (у web синие углы).

## 6. Что ещё осталось (бэклог паритета)

- **H3** эффекты текста серий (EffectText: глитч-копии, искры, турбулентность, scramble), цвета игроков.
- **Свечения** (п. 5.1) и **ghost-полосы** (п. 5.2).
- **CAM1** тряска камеры при своём выстреле (`humanController.shake()`); **G12** вид от третьего лица, FOV в ghost-фазе.
- **Звук** (музыка, SFX) и **AudioBar** (визуализатор, `audioViz` вкл. по умолчанию); StatsOverlay (FPS/скорость по настройкам).
- **Профили игроков**: имена, цвета, точки серий в верхней строке; экран результата E1–E3 (шрифт/разрядка, цвета, кнопка).
- **Скины G11**: шар-планета бота/игрока, скин луча (ClassicBeamFx), купол щита, след рывка, FX респавна, overheat-виньетка и молнии.
- **Меню M1–M8**: 3D-фон с шаром, логотип 0N35H07, кнопки темы, экраны Внешность/Настройки/Об игре, i18n (10 локалей),
  заставка-предупреждение; пауза в стиле web.
- **Лобби L1–L6**: режимы DUEL/BATTLE/WAR, места, боты и сложность, сетка превью карт + мультивыбор, длительность 3/5/10,
  код комнаты; карта `os_test` не перенесена.
- **Сеть в матче**: подключить NetSync к MatchNode, транспорт (ENet/WebRTC/Steam), RoomSession; **Steam** (GodotSteam);
  **радио** (WebView + Strudel); редактор карт; трейлер.

## 7. Грабли (не наступать повторно)

- `set_anchors_preset` у полноэкранного Control оставляет размер 0×0 → только `set_anchors_and_offsets_preset`;
  тесты раскладки — в `SubViewport` 1280×720 (headless root 64×64).
- SwiftShader теряет крутые GL_LINES и скин луча; Mesa llvmpipe рисует фантомную плиту → web только на Windows GPU.
- geo.json из three.js: лицевые грани против часовой; Godot — по часовой (`GeoLoader._godot_winding`).
- JS `Math.round(-0.5) = 0`, GDScript `round(-0.5) = -1` → `floori(v + 0.5)`.
- В web нижние скобки щита на 4px выше из-за строчного `<svg>` (`WEB_BASELINE_GAP`).
- `import measure` создаёт `tools/parity/__pycache__` (игнорируется `.gitignore`); не `git add tools` целиком без проверки.
- Предупреждение `could not lock config file .git/config` при `git branch -d` безвредно (песочница).
- В корне появляются char-device файлы `.bashrc`/`.gitconfig`/`.vscode` от песочницы — не коммитить.
- Playwright в WSL: браузер `~/.cache/ms-playwright/chromium_headless_shell-1234/...` через `executablePath`.
