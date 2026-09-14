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

## 3. Сделано (всё смержено в `release_2.0.0`, GUT 577/577)

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
| Ритуал готовности (R) | `MatchPhase` READY→COUNTDOWN→LIVE→ENDED (`add_participant`/`mark_ready`), боты готовы сразу; `ReadyOverlay` (подсветки, углы/список, подсказка, `ControlsLegend` на Consolas), клик → захват мыши + `mark_ready` + звук; `UnderlinedLabel`, `UiFont.css_width`; инструмент подтверждает готовность при монтировании (режимы `ready-duel`/`ready-2v2` — без); web `parity-capture-ready.mjs` |
| Фон карты в лобби (LM) | `MapBackground` за `MenuBackdrop`: два слоя (текущий и гаснущий 320 мс), превью cover в SubViewport, горизонтальное размытие во вложенном SubViewport один раз на карту, вертикальное на экране (`image_blur`, предумноженный цвет, brightness 0.7), проявление 0.7 s; web `parity-capture-lobby-map.mjs`, режим `lobby-map-<id>` |
| Трейлер T1a: данные повтора | `RemoteState` + `Player.remote` (геттеры замаха/рывка/щита/готовности берут состояние снаружи; `NetProtocol.apply_player_snapshot` его заполняет — пригодится и сети), `DemoClip` (записи `assets/demos/*.demo.json`, камера, снимки игроков), `DemoTimeline` (часы по фрагментам, смесь кадров, события, склейки, сигнал перед концом). Визуала пока нет — отчёта нет; спека `docs/superpowers/specs/2026-09-14-godot-trailer-design.md` |
| Трейлер T1b: воспроизведение | `PlayerNode.replay` (без симуляции, купол щита и сдутие замаха по `remote`, `play_remote_beam`), `MatchNode.replay` (часы записи), `Hud.replay` (без полосы звука/статистики/перегрева), `DemoPlayback` (карта, игроки, камера записи, события, сигнал `sound`; фон `#05070d`, без теней — как холст плана трейлера); web-хуки `__debugTrailerShot`/`__debugTrailerHoldFrame`, `parity-capture-trailer-frame.mjs`, режим `trailer-frame-<clip>-<frame>` на `scenes/trailer_frame.tscn` |
| Трейлер T2: секвенсор | `TrailerScreen` (`scenes/trailer.tscn`, `exit_scene` → меню, `Game.menu_screen` = about) по `TrailerEdl`: `HudCountdown` (тики, GO → `Audio.play_trailer_music`), `TrailerCutView` + `TrailerCut` (ключи CSS по свойствам, `GlowText` в `CssOpacity` под скошенным `Node2D`, шейдер полосы `trailer_cut_bar`, общий `css_box.gdshaderinc`), `DemoPlayback` под покрышкой (`CssTransition` с кривой), `DemoPlayback.announced` → свой `HudStreakBanner`, `TrailerSkipButton` (▸ на Consolas: `UiFont.base_with`, `mixed_line_px`), `TrailerTitleCard`, `hold_at`/`wake`; `Hud.replay` без вспышек/щитового свечения/баннера; `HudCountdown` — жирность Chrome и CSS-строка; web-хук `__debugTrailerHoldClock`, `parity-capture-trailer-cut.mjs` (анимации композитора → встроенный стиль), режим `trailer-shot-<план>-<ms>[-awake]` |
| Сеть N1: комната и меш-матч | `RoomSession` (`sim/net`, наследник `RoomModel`: HELLO/ASSIGN/READY/SETSLOT/START, владельцы, сид, FFA-спавны, повтор HELLO и таймаут через `tick`), `RoomModel`-хуки (`_publish`, `_announce_start`, `seat_guest`, `move_seat`, `resolve_against`, `apply_room`), `RoomCode`; `MatchNode.configure_mesh` (владение, `NetSync` с общими `MatchRules`, удалённые игроки по `InterpBuffer` −100 мс, события fired/respawn/ready, вердикты от владельца жертвы, фаза только от создателя, уход пира), `MatchRules.owns`/`claims`, `MatchPhase` creator/apply, `NetSession` phase+leave; меню держит комнату в `Game.room` (соло-`LoopbackNet`), `arena_boot` строит матч из `Game.match_setup` и закрывает комнату в `_exit_tree`; спека `2026-09-14-godot-network-steam-design.md` |
| Трейлер T3: финал | `FinaleTimeline` (замах 0.35×, выстрел, 0.05×, отъезд камеры, конец 7.5 s), `FinaleScene` (бойцы `BallVisual` + `WindupWorldView` + `BeamFx`, свет ÷ π, float-вьюпорт в `BloomChain`, композит меню «сцена SCREEN bloom», `hold_at` шагами 1/60), `BloomChain` вынесен из `MenuEdgeGlow`; `TrailerScreen` ставит финал под титр; `UiFont.bold_spaced`/`bold_spacing_px` — embolden Godot расширял каждую букву (size×embolden/64), теперь вычитается из разрядки; web-хуки `__debugFinaleHoldS`/`__debugFinaleAt`, `parity-capture-trailer-finale.mjs`, режим `trailer-shot-11-<ms>` |
| OV + G11e перегрев | `Player.apply_overheat`/`respawn_speed_mult`, `MatchRules.apply_comeback` (pierce всем), `MapBlocks` (прозрачность 0.2), `HudOverheatVignette` + `OverheatFx` (виньетка, молнии с цепочкой drop-shadow: в Chrome σ = N px) |

Отчёты: `test-results/parity-reports/` (baseline … player-profiles, skins-ball, skins-beam, skins-trails-shields, skins-windup-respawn, overheat, map-edges, audio, stats, ui-theme, main-menu, lobby, teams, nameplates, menu-backdrop, menu-glow, settings-about, appearance, appearance-previews, i18n, warning-splash, match-settings, ready-ritual, lobby-map, trailer-replay, trailer-sequencer, trailer-finale).
Замечания пользователя (свечения обводкой, рамка ghost-полос) — **закрыты** в H3.

## 4. Текущее состояние

Скины G11a–G11d, перегрев (OV + G11e), контур рёбер блоков (PP1), звук (SND), StatsOverlay, тема UI с паузой и
раскладка главного меню, лобби (L-a и L-b: матчи Battle / War), неймплейты и 3D-фон меню (шар, свет, позы камеры,
шары мест лобби), свечение краёв со звуком, размытие под панелью и экраны SETTINGS / ABOUT и APPEARANCE с превью
стилей, переводы интерфейса i18n (10 языков), заставка-предупреждение M6, настройки в паузе, ритуал готовности матча и
размытый фон карты в лобби и **трейлер целиком** смержены в `release_2.0.0`: T1 (воспроизведение записи, 1.24/255,
отчёт `2026-09-14-trailer-replay-*`), T2 (секвенсор: отсчёт 0.64, перебивка 0.08–1.82 после правки жирности, отчёт
`2026-09-14-trailer-sequencer-*`), T3 (финал 1.75/255, отчёт `2026-09-14-trailer-finale-*`). Сеть N1 (комната на
транспорте + меш-матч, без Steam; GUT 631/631) смержена. **Сеть N2 (Steam) смержена** (`feature/godot-steam`): аддон GodotSteam 4.22.1 (win64 + linux64),
`SteamApi` / автозагрузка `SteamBridge` / `SteamNet` / `SteamLobby` / `SteamQuickMatch` / `SteamNetWiring`, `LobbyState`
+ `DraftRoom`, зоны мест (INVITE A FRIEND, ADD A BOT, TAKE THIS SEAT, ожидание с пульсом, спин поиска),
`SteamFriendPicker`, `InviteToast` на стекле, потоки `MainMenu` (PLAY хостит Private-лобби, SEARCH/STOP, приглашение /
Join game / `+connect_lobby` → гость, закрытая комната гостя → снова хост), `tools/steam_smoke.gd` (живой Steam на этой
машине поднимается). Сверка — отчёт `2026-09-14-steam-lobby-*` (первый из двух с опечаткой в пути источника, верный —
последний): нативная полоса прокрутки десктопного WebView (`UiScroll`: жёлоб 10 px, стрелки 12 px, ползунок 6 px;
`LobbyScreen` сужает колонку при переполнении; полоса 0.02/255), `GlyphButton` (✕ с line-height 1), подгонка разрядки
`UiFont.fitted_spacing` по 100 глифам, `CssBoxShadow`; остаток — целая разрядка. GUT 685/685.
**Слайс DS (весь экран + масштаб по DPI) смержен** (`feature/godot-dpi-scale`): монитор стенда 3840×2160 при 150%;
`DisplayStartup.start` из `Game._ready` — весь экран (как Tauri `fullscreen: true`) и `content_scale_factor =
UiScale.for_dpi(DPI)` (на Windows `screen_get_scale()` = 1, берём DPI 144); `-s`-инструменты окно не получают (их
`_initialize` раньше `_ready` автозагрузок). Рендер-таргеты `MenuBackdrop`/`FinaleScene`/композит `EffectText` — в
физических px через `UiScale`. Отчёт `2026-09-14-display-scale-*`: весь экран совпал (панели 0.00–1.02/255), окно не
изменилось (0.00). GUT 692/692. **Съёмка на весь экран:** web `set PARITY_FULLSCREEN=1&& node scripts\<скрипт>.mjs
<папка>` (`parity-lib.mjs` `FULLSCREEN` 2560×1440 CSS × 1.5, для всех скриптов), Godot `--fullscreen` вместо
`--resolution` (`ui_scale` в фактах кадра). **Сеть N3 (Steam-профиль) смержена** (`feature/godot-steam-profile`):
`SteamAchievements` + `MatchAchievements` (локальный игрок, не против пассивного бота), `CloudProfileSync` +
`ProfileCloud` (старт до `load_profile`, метка/владелец в `user://profile_sync.json`) + `ProfileCloudPusher` (1 с через
`ProfileStore.save_hook`), `SteamPresence` (меню/лобби/матч); автозагрузка `SteamBridge` первой. Живой прогон
`tools/steam_smoke.gd` (`--log-file`, т. к. GUI-exe не пишет в консоль): имя, облачный блоб web-сборки читается, RP
ставится. Грабля: статическая функция `is_tool` на классе уходит во встроенный `Script.is_tool()`. Отчёт
`2026-09-14-steam-profile-*`. **Журнал сессии D1 смержен** (`feature/godot-game-log`): `GameLog` (статический, как web
`gameLog`), `GameLogFormat`, `LogRetention`, `GameLogSink` (`user://logs/oneshot-*.log`, 1 с / 400 строк, 15 файлов),
`GameLogErrors` (`OS.add_logger`), установка в `Game._ready` только при Steam и не `-s`; события web в комнате,
согласовании, матче, сети и лобби Steam. Живой запуск (`--quit-after 400`) записал `session_start`. Отчёт
`2026-09-14-game-log-*`. **Предсказание убийства N4 смержено** (`feature/godot-kill-prediction`): `NetSync.predict_death`
(из `MatchNode` после заявки своего игрока, пропуск при щите), `predicted_kill` с окном `NetConst.NET_PREDICT_KILL_MS`
250, подтверждение `kill`, откат `block` / по окну в `apply_peer_snapshot`, `Player.revive_from_false_prediction`;
тесты — перенос web `Match.predictedKill` и `mesh.deathProtocol`. Отчёт `2026-09-15-kill-prediction-*`.
**Дробная разрядка FS смержена** (`feature/godot-fractional-spacing`): `CssTextRun` (перо и размер дробные, отрисовка
`font_draw_glyph` под `draw_set_transform` + oversampling, жирный левее на половину роста `UiFont.embolden_growth`),
`CssLabel` (через `MenuText.label`; `_set` перехватывает `text`/перенос/обрезку — но собственные присваивания скрипта
мимо `_set`), `CssButton` → `UiButton`, `SegButton` (`set_label`, `keep_minimum_size`); `CssColumn` отдаёт долю
округления рамки в `css_offset_x`. Инструмент: режимы `menu*` скрывают фон, без наведения — `gui_disable_input`.
Отчёт `2026-09-15-fractional-spacing-*`: панели 0.23–0.72/255, буквы меню ±0.15 px. GUT 761/761.
**Вторая волна FS2 смержена** (`feature/godot-fractional-spacing-2`): на прогонах подсказка и чип версии меню,
заголовок паузы, подписи итога матча, имена/статусы/подсказка ритуала готовности, легенда (Consolas: строка из
метрик `SystemFont`), зоны/ники/спин мест лобби (`Zone`, `UiLink` → `CssButton`; наклон — копия грани
`FontVariation`), `UnderlinedLabel extends CssLabel`, `CssLabel.styled()`, `CssOffset.keep` (колонка, `SettingsRows`,
лобби). `CssButton` ставит базовую линию по формуле `button.cpp` (строка текста по центру без округления, подъём этой
строки). Инструмент: `ready-*` без захвата мыши (иначе виден HUD). Отчёт `2026-09-15-fractional-spacing-screens-*`.
GUT 766/766. **Третья волна FS3 смержена** (`feature/godot-fractional-spacing-3`): `GlowText.configure_css` /
`EffectText.configure_css` (текст, маска свечения, простой текст и глитч-копии — `CssLabel`; прежний `configure(font)`
рисует нативно), `CssLabel` рисует тень шрифта; на прогонах логотип, карусель (левый отступ 0.24em дробный), итог
матча (заголовок с `padding-left` одной разрядки, имена), имена и таймер HUD, панель команд (имена, таймер, фраги),
баннер, ghost, StatsOverlay (базовая линия прогона). Грабля съёмки: `hud-stats` читает `web-stats.json` рядом с
выходным PNG. Отчёт `2026-09-15-fractional-spacing-glow-*`. GUT 768/768.
**Слайс CR (дробные строки HUD) смержен** (`feature/godot-css-row`): `CssRow` (flex-строка: дробные ширины, `gap`,
центр по вертикали, `justify` в `css_width`, доля пикселя — текстам и вложенным строкам, `centre_in` для
`translateX(-50%)`); `BoxContainer` округлял ширины вверх (`box_container.cpp` `.ceil()`). Сверка нашла: рамка
таймера без бордюра (109 вместо 111 px) и 1 px у пустого `Label` (точки серии) → `CssLabel.css_size()`,
`CssColumn.box_size`. Отчёт `2026-09-15-css-row-*`: глифы панели ±0.7 px. GUT 774/774.
**Эксперимент радио смержен** (`feature/godot-radio-spike`): аддон godot_wry v1.0.2 (`addons/godot_wry`, WebView2),
пробы `tools/probes/webview_audio_probe.gd|.html`, `webview_api_probe.gd` → `test-results/probes/webview/`.
Итог: `autoplay = true` запускает `AudioContext` без жеста (env `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` не действует);
скрытый WebView душит таймеры (~1/с), коробка 1×1 за экраном — полный темп; IPC `window.ipc.postMessage` ↔
событие `message` на `document`, нужно рукопожатие. Регистрация расширения — импорт Windows-сборкой. Спека подпроекта:
`docs/superpowers/specs/2026-09-15-godot-radio-design.md`. **Дальше:** (1) R1 — хост движка (сборка Vite модулей
web + `radioHost.ts`), автозагрузка `RadioHost` (WebView 1×1), `RadioModel`, протокол IPC с тестом, живой прогон;
затем R2 мини-плеер + DLC, R3 экран радио, R4 библиотека, R5 матч/свечение; (2) хвост разрядки — трейлер,
заставка, тост (`RichTextLabel`), поля ввода; `line-height: 1` точек серии. **Переносим только Steam-версию** (десктоп, `IS_DESKTOP`): браузерные non-steam фичи не нужны.
Эталон web для экранов — десктопная сборка: заглушка `__TAURI_INTERNALS__` (см. `parity-capture-settings.mjs`).
Спека лобби: `docs/superpowers/specs/2026-09-14-godot-lobby-design.md`.

## 5. Что ещё осталось (бэклог паритета)

- Открыто по звуку: форма кроссфейда, реверб/эхо шинами вместо свёртки web, нет де-клика (отчёт `2026-09-14-audio-*`).
- **Дробная разрядка букв, хвост**: экраны, HUD, итог, готовность, логотип и карусель уже на `CssTextRun` (отчёты
  `2026-09-15-fractional-spacing-*`, `-screens-*`, `-glow-*`); трейлер, заставка M6, тост и поля ввода ещё на целом
  `spacing_glyph`; строки HUD уже на `CssRow` (отчёт `2026-09-15-css-row-*`), прочие `HBoxContainer` (лобби, выбор
  друга) округляют дробные ширины.
- Открыто после темы UI: MENU — дробная базовая линия Chrome (отчёт `2026-09-14-ui-theme-*`).
- Открыто после лобби: нет сети (Steam-приглашения, SEARCH, гости; в проекте нет аддона GodotSteam) (отчёты
  `2026-09-14-lobby-*`, `2026-09-14-teams-*`, `2026-09-14-nameplates-*`).
- Открыто после трейлера: жирные буквы на 2 px выше (титр, перебивка), цифра отсчёта на 2 px правее/выше, CTA на 1 px;
  случайные рывки rage / частицы singularity не детерминированы (отчёты `2026-09-14-trailer-sequencer-*`,
  `2026-09-14-trailer-finale-*`). Правка жирности (`bold_spacing_px`) затронула крупный жирный текст всех экранов —
  другие экраны после неё не пересняты.
- Открыто после главного меню: мягкий Bloom радио не перенесён (отчёт `2026-09-14-menu-glow-*`);
  RADIO скрыт до радио (отчёт `2026-09-14-settings-about-*`).
- Открыто после i18n: высота CJK-строки на 12 / 14 / 24 px (Chrome 16 / 19 / 31, Godot 17 / 17 / 32) — поправки
  спуска на запасной вариации не влияют, нужен свой расчёт строки для CJK-текста (отчёт `2026-09-14-i18n-*`).
- **Лобби L1–L6**: режимы DUEL/BATTLE/WAR, места, боты (ник/сложность), карты мультивыбор, длительность 3/5/10,
  код комнаты; карта `os_test`; ready-оверлей (фаза ready).
- **Сеть в матче**: NetSync к MatchNode, транспорт (ENet/WebRTC/Steam), RoomSession; **Steam** (GodotSteam, имя из Steam);
  **радио** (WebView + Strudel); редактор карт; неймплейты 2v2/FFA.

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
- Матч стартует в фазе READY: съёмка матча без подтверждения игрока застынет до отсчёта → `screenshot.gd` зовёт
  `MatchNode.mark_ready(HUMAN)` при монтировании (кроме `ready-*`); GUT-тесты матча используют `force_live()`.
  GDScript: `var x := arr.back().method()` на нетипизированном Array не выводит тип → явный тип.
