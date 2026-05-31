# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OneShot — аркадный шутер от первого лица. Стек: React 19 + React Three Fiber (@react-three/fiber 9) +
Three.js 0.184 + @react-three/rapier 2 (физика), Trystero (WebRTC P2P), сборка Vite 8, TypeScript 6,
опционально Electron.

## Development Rules

- При разработке ВСЕГДА пользуйся плагином Superpowers.
- После каждой правки прогоняй тесты в headless режиме (`npm run test`), актуализируй тесты под правки.
- Когда выполняешь что-то из TODO.md ВСЕГДА зачёркивай выполненное.
- После правок делай ВДУМЧИВОЕ ревью своего кода, чтобы не доводить до массового рефакторинга.
- Ты ОБЯЗАН следовать принципам SOLID, DRY и SRP при разработке
- Ты НИКОГДА не используешь магические числа. Только константы

## Команды

- `npm run dev` — Vite dev-сервер (http://localhost:5173).
- `npm run build` — `tsc -b && vite build` (полная проверка типов + прод-сборка).
- `npm run lint` — ESLint.
- `npm run test` — **канонический прогон**: vitest (юнит) + Playwright headless (e2e). Гонять после правок.
- `npm run test:unit` / `test:e2e` / `test:headed` / `test:connected` — по отдельности
  (`test:connected` использует уже открытое окно браузера).
- Один юнит-тест: `npx vitest run --config vitest.config.ts tests/unit/Shield.test.ts` (или `-t "имя"`).
- Один e2e: `npx playwright test --project=headless tests/shooting.spec.ts` (или `-g "подстрока"`).
- Только типы, без сборки: `npx tsc -b --noEmit`.
- Electron: `npm run electron:dev`, `npm run electron:build`.

Замечание по типам: включён `erasableSyntaxOnly` — **нельзя** parameter properties (`constructor(private x)`),
enum'ы, namespace'ы. Поля объявляй явно и присваивай в теле конструктора.

## Архитектура (big picture)

Три слоя: **симуляция — чистые TS-классы в `src/game/` (без React); R3F — тонкий хост; HUD — React/DOM-оверлей.**

**Симуляция (`src/game/`).** Единая сущность `Player` — и человек, и боты, и будущие сетевые игроки —
композирует **инжектируемые** `Body` + `IWeapon` (`BeamWeapon`) + `IShield` (`Shield`) (Dependency Inversion).
У `Player` intent-методы `moveIntent/jump/aim/startFiring/activateShield` с вшитыми кулдаунами. Контроллеры
(`HumanController` — клавиши/мышь/камера; `BotController` — ИИ) дёргают **одни и те же** методы `Player`:
ИИ — это просто ещё один контроллер, как клавиатура. `Player` **не респавнит сам себя** — это делает `Match`.
`Match` владеет миром/игроками/контроллерами и является **единственным местом правил** (боёвка, респавн,
HUD-события, исключение «своей команды»); его `update(dt)` — общий пульс.

**R3F-хост.** `App` рендерит `<Canvas>`; `Game` один раз строит `Match` (`useMemo`) и крутит один
`useFrame((_, dt) => match.update(Math.min(dt, 0.1)))` (dt клампится от скачков кадра). Каждый игровой объект
**сам владеет своими THREE-мешами**; world-space визуал (тела + лучи) живёт в `match.root`, рендерится через
`<primitive object={match.root} />`. Порядок `Match.update`: `syncFromBody` → `controllers.update`
(намерения/прицел) → `players.update` (оружие/щит/визуал) → `applyPhysics` → combat/respawn/HUD →
`controllers.lateUpdate` (камера читает свежий кэш позиции).

**Физика — Rapier KinematicCharacterController.** `<Physics timeStep="vary" interpolate={false}>` в `Game`.
На игрока — `<RigidBody type="kinematicPosition">` **только с `<CapsuleCollider>`** (физика). **Визуал развязан
с RigidBody:** `bodyGroup` НЕ кладётся внутрь `<RigidBody>` (иначе двойной трансформ хитбокса) — он в
`match.root` и позиционируется из `rb.translation()` в `Player.syncFromBody`. Движение — один общий KCC:
`Body` копит намерение (`desired`/`velocityY`), `Match.applyPhysics` (inline в `update`) зовёт
`computeColliderMovement` → `setNextKinematicTranslation`. Гравитацию/прыжок считаем сами (kinematic игнорит
мировую `gravity`). `RapierBridge` (через `useRapier`) отдаёт `Match` физический мир. Грабли: **не** включать
`enableSnapToGround` (гасит прыжок); арена — статические `<CuboidCollider>`.

**Боёвка и raycast — на Three.js, не на Rapier.** `World.raycast` бьёт по меш-хитбоксам с `userData.entityId`;
`excludeEntityIds` исключает свою команду (нет friendly-fire, нет само-попадания). Капсула-коллайдер — только
для движения. Меши, которые не должны быть raycast-целью, помечаются `userData.noRaycast` сразу при создании.

**HUD/меню.** HUD — React/DOM-оверлей на `useGameHUD` (reducer в `App`); `Match` шлёт в него HUD-экшены.
Меню/лобби — машина состояний экранов в `App` (menu/join/lobby/game) + hash-роутинг. Лобби **всегда p2p**:
создатель кода = хост, вход по `#CODE` = клиент; ростер (люди+боты) держит `LobbySession`. Для e2e есть
debug-глобалы `__debugCamera/__debugWindup/__debugTargetHitCount/__debugBotPos/__debugRole/__debugPlayerPos`.

**Сеть — P2P, host-authoritative (`src/net/`).** Одиночной игры нет: «один с ботами» = вырожденный хост-лобби
без подключившихся. `Match` получает `role` (`local|host|client`): **хост** авторитетно симулирует всех (свой
человек + боты `BotController` + удалённые люди `RemoteInputController`) и шлёт **снапшоты** (позиция/визуальные
флаги) + **события** (`fired/kill/block/respawn/scores`); **клиент** предсказывает только своего (KCC локально),
а удалённых рендерит из снапшотов с интерполяцией (`updateRemote`, без прогона их боёвки). Слои: `INet` —
транспорт (`TrysteroNet` интернет / `BroadcastChannelNet` вкладки+e2e / `LoopbackNet` юниты; выбор —
`createNet`/`?net`), `protocol.ts` — JSON-сообщения + ростер, `NetSession` — оркестратор (`afterUpdate` после
`match.update`), `intentsFromInput` — хост применяет `InputFrame` клиента теми же intent-методами (DRY через
`controllers/movement.ts`). Боёвку считает **только** хост (raycast в его мире) — клиенту не доверяем попадания.
TURN-хук — `NET_ICE_SERVERS` (пусто = STUN). Грабли: имена action ≤12 байт; снапшоты троттлятся `NET_SNAPSHOT_HZ`.

**Стратегия тестов.** Rapier (WASM) и r3f-рендер не идут в jsdom → **физику/движение/столкновения/сеть-в-браузере
тестируем в e2e** (`tests/*.spec.ts`, реальный Chromium; `multiplayer.spec` — две страницы через
BroadcastChannel). Юнит-тесты (`tests/unit/*.test.ts`) держат чистую логику: классы конструируются напрямую,
`Match.applyPhysics` без Rapier — no-op, сетевой слой тестируется через `LoopbackNet` (host↔client in-process).