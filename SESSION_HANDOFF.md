# Передача сессии — OneShot: перенос web → Godot (обновлено 14.09.2026, ночь, Claude Code, WSL)

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
  Хуки web: `__debugAnnounce(kind)`, `__debugStreak(id,n)`, `__debugPlayerColor(id)`, `__debugTimeScale(k)` (только
  симуляция; `Date.now`-визуалы не замедляет), `__debugKill(id)`, `__debugRespawning(id)`, `__debugSetStreak(id,n)`
  (настоящая серия: перегрев/pierce/прозрачность + HUD), `__debugForceEnd`, `__debugAudioBands`, `__debugStats`
  (заморозить FPS/худший кадр/историю/скорость), `__debugLockCooldownLeft` (заморозить кулдаун RESUME), …
  Ещё скрипты: `parity-capture-skins/-beams/-shield-dash/-windup-respawn/-overheat/-audio-bar/-stats/-buttons.mjs`.
  Пауза в web = снять поддельный lock (`pointerLockElement` → null); мышь двигать ТОЛЬКО после снятия. Vite из WSL на /mnt/c не видит правок —
  перезапускать (`pgrep -f "^node node_modules/vite"` + kill; `pkill -f` убивает свою оболочку).
- Замеры: `python3 tools/parity/measure.py [--hud] a.png b.png`; вырезки: `python3 tools/parity/crop.py in out x y w h [scale]`.
- Отчёт: спека `tools/parity/stages/<id>.json` → `python3 tools/parity/report.py <spec>` → открыть HTML локально.

## 3. Сделано (всё смержено в `release_2.0.0`, GUT 550/550)

| Слайс | Суть |
|---|---|
| Сеть: victim-judged hit claims | NetSync/NetSession, 16 тестов (к матчу НЕ подключено) |
| Инструменты сверки | report.py, parity-capture*.mjs (отказ на SwiftShader), crop.py |
| Карта G7/G8/G10, часы G9, пол/свет G6+W1, сетка B1 | спавны, коллизии, MatchClock/результат, FloorGrid/MapLights, BlockGrid |
| HUD H1, эффекты H2 | верхняя строка, прицел, скобки, рывок; отсчёт, баннер, ghost, виньетки, вспышки |
| H3 эффекты серий + размытые свечения | `StreakFx`/`CssTiming`/`CssShadow`, `GlowText` (гауссово размытие через SubViewport), `EffectText`, шейдеры glow_*/text_turbulence; длительность по умолчанию 3 мин |
| CAM1/G12 камера и управление | `CameraModel`, `HumanController`: ЛКМ/ПКМ(щит)/Shift/V события, чувств. 0.002×0.15, наклон ±90°, тряска, FOV ghost, третье лицо, прицел лучом из камеры |
| P1 профили игроков | `PlayerProfile`/`ModelNames`/`BotAppearance`/`Roster`/`ProfileStore`; ники и цвета в HUD, баннере, результате; фиксы размеров текста и области фильтра серий |
| G11a шар | `BallVisual` (модели/кольцо/рисунок), `SkinCurves`, `ParticlePool`/`DeathBurst`/`AfterimageTrail`, замах шара, призрак, «пуф»; `HudThrottle`/`CssTransition` |
| G11b лучи | `BeamFx` classic/rage/singularity (`BeamCurves`), бот — classic `#f44`, искры только от выстрелов человека |
| G11c щиты и следы | `ShieldFx` dome/hex/crystal (`ShieldSkinState`), `DashTrailView` streak/wave/rift |
| G11d замахи и респавны | `WindupWorldView` (`RageJaws`, `SingularityVortex`, точки `size_attenuated_points`), `RespawnFxView` echo/chaos/swarm (`ChaosRespawn`, `SwarmRespawn`); шар пишет глубину в призраке |
| Звук (SND) | `MusicRng`/`MusicDirector`/`MenuMusicArranger` (сверены оракулом web), `MusicSlots`/`MusicScheduler`/`MusicEngine` (слот-плееры с `AudioStreamInteractive`, переход на следующий такт = 8 с), `MatchSfx`/`SfxEngine`/`MatchAudio`, автозагрузка `Audio` (меню, UI, `AudioAnalysisHub`), `HudAudioBar`; стемы/SFX → Ogg (`tools/audio/convert_web_audio.py`) |
| StatsOverlay | `StatsModel` (окно 500 мс, история 150, форматы web) + `HudStatsOverlay` (FPS, график 150×46 отрезками, скорость) по `showFps`/`showSpeed`; рамки на целых пикселях как в Chrome |
| Тема UI + пауза (UT) | `UiButton` (primary/secondary/ghost), `UiTokens`, `CssColumn`/`CssPixel`/`CssOpacity`, `UiFont.with_css_line`/`trailing_spacing_style`/`bold_spaced`; `PauseModel` + `PointerLock` (пауза не стопит матч, кулдаун RESUME 1300 мс, HUD скрыт без захвата); колонка результата (E2) |
| Главное меню M2/M4 (MM) | `MainMenu`: панель 680 px (фон .72, боковые линии), логотип 0N35H07 (жирный, свечение 30 px), линия, PLAY/APPEARANCE/SETTINGS/ABOUT/QUIT шириной 50%, чип версии (открывает папку логов); выбор карты убран из меню (web — в лобби) |
| Лобби L-a (L1–L5) | `GameModes`, `RoomModel` (правила хоста без сети), `MapCatalog` (+`os_test`, превью), `LobbyScreen` в панели меню: `ModeCarousel`, `MapTile`, `SegButton`, `LobbySeat` (`CssDashedBorder`, свечение `glow_rect`); READY стартует дуэль (карта, длительность, бот/пассивность) |
| Лобби L-b: Battle / War | `Spawns.positions_for_mode` (кластеры 2v2, точки FFA) + `gen_ffa_spawns`, `NearestEnemy` (цель бота), `arena_boot` из `Game.lobby_roster`/`lobby_mode` (N участников, команды по местам), `HudTeamBar` + `TeamBarModel` (панели вокруг таймера, итоги команд), `MatchNode.players()/scores()` |
| Неймплейты 2v2/FFA | `Nameplate` (Sprite3D billboard; текст из SubViewport, фон и композит — шейдер `nameplate` в числах холста как линейном свете), `PlayerNode.set_nameplate` (видна при `alive`), выдача в `arena_boot`; web-хук `__debugPlace` |
| PP1 контур рёбер блоков | `MapEdges`: копии raycast-блоков на слое 20 → float-SubViewport (нормаль+глубина), квад `map_edges` (blend_mul) |
| 3D-фон меню (MB) | `MenuBackdrop` (прозрачный мир, композит `premultiplied_viewport`), `MenuCameraRig` (позы web JSON), `MenuStageBall` (прогрев/проявление/уход), `MenuStage.balls` (свой шар в меню, все места лобби на `STAGE_SPOTS`); web-хуки `__debugMenuLightAngle`/`__debugMenuGlowLevel`/`__debugMenuBallTime` |
| Свечение краёв + размытие панели (MG) | `MenuEdgeGlow` (вложенные float-вьюпорты: двойники моделей → глубина/цвет → контур → Bloom postprocessing: яркость, 8 mip вниз, 7 вверх; композит SCREEN), `MenuGlowLevel` (√уровня звука, сглаживание, монтирование 600 мс, `menuGlow`), `PanelBlur` (`backdrop_blur` σ 2 px); `MenuBackdrop` теперь Control с `View` |
| Экраны SETTINGS / ABOUT (SA) | `SettingsScreen` (desktop-вкладки PLAYER/SOUND/GRAPHICS, запись профиля сразу + `Audio.apply_volumes`), `AboutScreen`; контролы `UiToggle`, `UiSlider`, `UiTextField`, `UiLink`, `UiButton.Metrics`; `MenuText` (h2, подпись, подзаголовок — и в лобби); `Locales` (id, родные имена, detectLocale); `UiFont.mirror_fallbacks` (жирный/разрядка у кириллицы и CJK), дробные CSS-кегли; `defaultView` → `HumanController` |
| Экран APPEARANCE (AP) | `AppearanceScreen` (прокручиваемая страница, правила цветов, запись профиля), `ColorSwatch` (шейдер кольца + свечения), `BallPaintField` (растр холста), `BallArt.encode/decode`, `UiScroll`; `MainMenu.panel_slide` (сдвиг панели вправо, τ 0.06), позы камеры по `part`, `MenuBackdrop.facing_of` / `glow_muted` |
| Превью стилей (AP-2) | `MenuPreviewCycles` (таймлайны SHOT/RESPAWN/DASH/SHIELD), `MenuStagePreview` (игровые эффекты на шаре превью, порядок шагов web), `MenuBackdrop.preview_style` / `pin_preview_hold_ms`; мир фона во float (`use_hdr_2d`) + цепочка свечения на экране превью = Bloom луча в тишине; web-хук `__debugPreviewHoldMs` |
| i18n (I) | `I18n` (словари `assets/i18n/<id>.json` из `web-reference/scripts/export-i18n.mjs`, шаблоны `{0}`; язык из профиля в `Game._ready`), тексты всех экранов и HUD по ключам; выбор языка пересобирает колонку меню и SETTINGS (`locale_changed`); zh-CN: `UiFont.control_spacing_em` (0.05em), `TranslationServer` zh_CN → YaHei, высота кнопок по содержимому; кириллица — `with_css_line` и для запасных; захват `locale-<id>:`, web `PARITY_LOCALE` |
| Заставка M6 (W) | `WarningSplash` поверх `MainMenu` один раз за запуск (`Game.warning_seen`), `WarningTimeline` (проявление 320, подсказка 1500/240, пульс 4 s, затухание 280 мс), шейдер `warning_backdrop`, планета из SVG web (`Image.load_svg_from_string`), `CssLineBreak` (переносы Chrome), ⚠ на Segoe UI Symbol (`UiFont.with_face_line`); web `parity-capture-warning.mjs` (анимации на паузе через `getAnimations`), режимы `warning[-early|-peak]` |
| Настройки в паузе (MS) | `MatchSettings` в `PauseOverlay` (`open_settings`/`close_settings`, сброс при снятии паузы), общие `SoundControls`/`GraphicsControls`/`SettingsRows` (вынесены из `SettingsScreen`), `profile_changed` → сохранение, громкость, `MapEdges.set_enabled`; `set_desktop(false)` = раскладка браузера; web `parity-capture-match-settings.mjs`, режим `pause-settings-<tab>` |
| OV + G11e перегрев | `Player.apply_overheat`/`respawn_speed_mult`, `MatchRules.apply_comeback` (pierce всем), `MapBlocks` (прозрачность 0.2), `HudOverheatVignette` + `OverheatFx` (виньетка, молнии с цепочкой drop-shadow: в Chrome σ = N px) |

Отчёты: `test-results/parity-reports/` (baseline … player-profiles, skins-ball, skins-beam, skins-trails-shields, skins-windup-respawn, overheat, map-edges, audio, stats, ui-theme, main-menu, lobby, teams, nameplates, menu-backdrop, menu-glow, settings-about, appearance, appearance-previews, i18n, warning-splash, match-settings).
Замечания пользователя (свечения обводкой, рамка ghost-полос) — **закрыты** в H3.

## 4. Текущее состояние

Скины G11a–G11d, перегрев (OV + G11e), контур рёбер блоков (PP1), звук (SND), StatsOverlay, тема UI с паузой и
раскладка главного меню, лобби (L-a и L-b: матчи Battle / War), неймплейты и 3D-фон меню (шар, свет, позы камеры,
шары мест лобби), свечение краёв со звуком, размытие под панелью и экраны SETTINGS / ABOUT и APPEARANCE с превью
стилей, переводы интерфейса i18n (10 языков), заставка-предупреждение M6 и настройки в паузе (GUT 550/550) смержены в
`release_2.0.0`. Следующие слайсы: сеть/Steam-лобби (в десктопной сборке дуэль со свободным местом показывает SEARCH
вместо READY, Steam-приглашения), радио (кнопка RADIO и мини-плеер в меню десктопа). **Переносим только Steam-версию** (десктоп, `IS_DESKTOP`): браузерные non-steam фичи не нужны.
Эталон web для экранов — десктопная сборка: заглушка `__TAURI_INTERNALS__` (см. `parity-capture-settings.mjs`).
Спека лобби: `docs/superpowers/specs/2026-09-14-godot-lobby-design.md`.

## 5. Что ещё осталось (бэклог паритета)

- Открыто по звуку: форма кроссфейда, реверб/эхо шинами вместо свёртки web, нет де-клика (отчёт `2026-09-14-audio-*`).
- **Дробная разрядка букв**: `FontVariation.spacing_glyph` — целое (0.08em × 13 px = 1.04 → 1), длинные строки
  к концу отстают на 1–2 px (отчёты hud-core, stats); общее решение для всех текстов `UiFont.spaced`.
- Открыто после темы UI: MENU — дробная базовая линия Chrome (отчёт `2026-09-14-ui-theme-*`).
- Открыто после лобби: нет сети (код комнаты, «вход по коду», Steam-приглашения, SEARCH, гости) и размытого превью
  карты в фоне (отчёты `2026-09-14-lobby-*`, `2026-09-14-teams-*`, `2026-09-14-nameplates-*`).
- Открыто после главного меню: WATCH в ABOUT шлёт
  `screen_requested('trailer')` — трейлера нет; мягкий Bloom радио не перенесён (отчёт `2026-09-14-menu-glow-*`);
  RADIO скрыт до радио (отчёт `2026-09-14-settings-about-*`).
- Открыто после i18n: высота CJK-строки на 12 / 14 / 24 px (Chrome 16 / 19 / 31, Godot 17 / 17 / 32) — поправки
  спуска на запасной вариации не влияют, нужен свой расчёт строки для CJK-текста (отчёт `2026-09-14-i18n-*`).
- **Лобби L1–L6**: режимы DUEL/BATTLE/WAR, места, боты (ник/сложность), карты мультивыбор, длительность 3/5/10,
  код комнаты; карта `os_test`; ready-оверлей (фаза ready).
- **Сеть в матче**: NetSync к MatchNode, транспорт (ENet/WebRTC/Steam), RoomSession; **Steam** (GodotSteam, имя из Steam);
  **радио** (WebView + Strudel); редактор карт; трейлер; неймплейты 2v2/FFA.

## 6. Грабли (не наступать повторно)

- Chrome композитит дробные рамки DOM на целых пикселях (холст на 138.5 рисуется с 139, базовая линия текста
  округляется) → в Godot округлять верх рамки и базовую линию (`HudStatsOverlay._whole_pixel`). Сглаженная
  `draw_polyline` срезает острие резкого пика — рисовать отрезками `draw_line`.
- three.js `CanvasTexture` без `colorSpace` читает sRGB-числа холста как линейный свет (картинка светлее);
  прозрачный Godot 2D-вьюпорт хранит цвет premultiplied в sRGB — полупрозрачный фон после декодирования темнее
  (c·α^2.2) → композит полупрозрачного делать в шейдере. Параллельные Bash-вызовы делят cwd: `cd` одного ломает
  относительные пути другого — пути абсолютные, `git -C`.
- GDScript: поле `var _ready` рядом с виртуальным `func _ready()` ломает разбор всего класса («Could not parse global
  class») — не называть поля именами колбэков. `Button`-потомки меряются нативно: скриптовый `_get_minimum_size`
  игнорируется → `custom_minimum_size`. `queue_free` оставляет узел в дереве до конца кадра — новые узлы с тем же
  именем переименуются (`remove_child` сперва). Tween, запущенный до раскладки, перезапишет позднюю раскладку — гасить.
- Chrome не рисует `text-decoration` внутри `<input>`; пунктир 2 px: штрих 3 толщины, промежутки выровнены по стороне,
  углы скруглены; web-цвет `#37f` + `55` = невалидный 5-значный hex → рамка колонки команды прозрачна.
- `tools/screenshot.gd` (скрипт `-s`) не должен ссылаться на тип класса, который использует имена автозагрузок
  (`Audio`, `Game`) — компиляция инструмента падает («Identifier not found: Audio»); звать методы через `call()`.
- Текст Chrome: высота строки `normal` = округлённые подъём + спуск (Godot округляет вверх: 16 px 15 + 4 вместо 14 + 4)
  → `UiFont.with_css_line`; разрядка CSS идёт и после последней буквы → `trailing_spacing_style` / правое поле кнопки.
  Синтетический жирный Godot (`variation_embolden`) шаг букв НЕ расширяет.
- CSS `opacity` = прозрачность собранного слоя; `modulate` (и `clip_children`) гасят каждый вызов отрисовки —
  текст над заливкой бледнеет → `CanvasGroup` (`CssOpacity`, `UiButton.grouped()`).
- Пауза в Godot: `get_tree().paused` не ставить (web-матч идёт дальше); HUD виден только при захвате мыши.
  Тестам HUD нужен `tests/support/locked_pointer.gd` (headless мышь никогда не захвачена); `Hud.setup` вызывать
  один раз — повторный connect сигналов = ошибка движка в GUT.

- Звук: у узла дети выходят из дерева раньше родителя — не спрашивать у дочернего движка шину в `_exit_tree`;
  Callable на метод не держит RefCounted живым; в GutTest нельзя назвать хелпер `_input`; автозагрузки не глобальны
  в `-s`-скриптах (брать `root.get_node_or_null`); у `AudioStreamInteractive` `get_playback_position()` = 0;
  такт = `bar_beats` (16 для 8-секундной петли); headless-драйвер микширует и пишет звук.
- `set_anchors_preset` у полноэкранного Control оставляет размер 0×0 → только `set_anchors_and_offsets_preset`;
  тесты раскладки — в `SubViewport` 1280×720 (headless root 64×64).
- `Label.get_minimum_size()` сразу после `add_theme_font_override` — ещё со старым шрифтом → `minimum_size_changed`.
- Прозрачный SubViewport хранит premultiplied-цвет; выводить его `render_mode blend_premul_alpha` (3D-фон меню:
  без этого полупрозрачное кольцо планеты темнее на 11.5/255). Часы шейдера web-шара живут в `Body` — при смене
  модели Body пересоздаётся с нулём, хук времени должен сбрасываться вместе с ним.
- three.js фильтрует и источники света слоями камеры: проход по слою моделей (web `MenuEdgeGlow`) рисует шары
  чёрными — цвет контура серый, не цвет шара. Godot рисует дочерний SubViewport раньше родителя → цепочку
  постобработки вкладывать «читатель снаружи». SubViewportContainer рисует все дочерние SubViewport — цепочку и мир
  держать под обычным узлом, показывать через `TextureRect`. Кадры фона без UI должны прятать и `PanelBlur`.
- «N resources still in use at exit» в GUT/съёмке — музыкальные потоки автозагрузки `Audio` и скрипты сетевых
  тестов (`--verbose`: ни одного ресурса свечения); к слайсам меню не относится.
- Шрифты: у `FontVariation` с пустыми `fallbacks` запасные начертания (кириллица, CJK) идут без `spacing_glyph` и
  `variation_embolden` → `UiFont.mirror_fallbacks`. Запасной системный CJK поднимает высоту ВСЕХ строк варианта —
  давать его только тексту с китайским (`UiFont.base_cjk`). Godot округляет шаг глифа до пикселя (0.54em × 12 = 7,
  а не 6.48) → CSS `ch` мерить в крупном кегле. Кегли rem дробные (11.2, 13.6, 20.8) → ближайший целый размер, а
  разрядка и строка — от CSS-размера (`css_px`).
- GDScript: `PackedByteArray` — значение; `(dict[k] as PackedByteArray)[i] = v` и `dict[k].fill(0)` меняют копию →
  взять в переменную, изменить, записать обратно. Headless Chromium прячет полосы прокрутки (`--hide-scrollbars`) →
  для прокручиваемых панелей `launchReferencePage({ showScrollbars: true })`; Chrome ≥ 121 с `scrollbar-width: thin`
  игнорирует `::-webkit-scrollbar` (нативная полоса 10 px со стрелками).
- Кадры с анимацией: Playwright `click()` прокручивает панель к кнопке (вернуть `scrollTop`); глитч челюстей rage —
  монета раз в 160 мс (снимать до 160 мс); web-композитор фона блумит HDR-яркое даже в тишине — мир фона во float.
  «Потемнение» полупрозрачного во float-вьюпорте оказалось глитчем rage, а не HDR — сначала искать случайность.
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
- i18n: системный запасной шрифт Godot выбирает начертание по локали `TranslationServer` (en → Yu Gothic для
  китайского) и растит только строки, где он использован; явный `SystemFont` в `fallbacks` растит ВСЕ строки, а его
  `spacing_top/bottom` на высоту строки не влияют. Высоту кнопок не брать константой (китайская строка → 47 px).
  `TextLine.add_string` без языка не смотрит на локаль `TranslationServer` (в отличие от `Label`). В cmd.exe
  `set VAR=x&& node …` работает, а `> nul` внутри той же строки ломает запуск.
- Какой системный шрифт Chrome взял для глифа — CDP `CSS.getPlatformFontsForNode` (⚠ → Segoe UI Symbol; Godot сам
  возьмёт цветной Segoe UI Emoji → явный `SystemFont` + `UiFont.with_face_line`). CSS-анимации web для кадров
  замораживать без хуков: `document.getAnimations()` → `pause()` + `currentTime`. `CssTiming.cubic_bezier` на концах
  теперь точно 0 / 1 (бисекция оставляла 3e-10).
- Десктопное (Tauri-заглушка) лобби web показывает зоны Steam-приглашений, и `enterLiveMatch` не добавляет бота →
  кадры матча/паузы снимать в браузерной сборке; отличие панели настроек — слайдер радио (`PauseOverlay.set_desktop`).
  Инструмент `-s` ссылается на `PauseOverlay` типом → в нём нельзя имена автозагрузок (`Game`); профиль отдаёт `arena_boot`.
