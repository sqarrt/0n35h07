# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OneShot — аркадный шутер от первого лица. Стек: React 19 + React Three Fiber (@react-three/fiber 9) +
Three.js 0.184 + @react-three/rapier 2 (физика), Trystero (WebRTC P2P), сборка Vite 8, TypeScript 6,
опционально Electron.

## Base rules

- Общайся с пользователем по-русски
- Избегай лишних cd (change directory) запросов
  - В особенности не делай cd в текущую рабочую директорию (ты уже в ней находишься)
  - Когда захочешь сделать cd - перепроверь себя, не находишься ли ты в этой директории
- Не читай @TODO.md

## Development Rules

- При разработке ВСЕГДА пользуйся плагином Superpowers.
- Разработка в ветке ВСЕГДА завершается мержем в мастер, если пользователь одобрил состояние ветки.
- **Коммиты (многострочное сообщение):** НЕ передавай тело через PowerShell here-string `@'...'@` в Bash-тул —
  bash трактует `@'` как литералы и в сообщение влетают символы `@`. Пиши сообщение во временный файл и
  коммить через `git commit -F <файл>` (надёжно в любом шелле), либо bash-heredoc (`cat > f <<'EOF' … EOF`).
  Синтаксис `@'…'@` допустим ТОЛЬКО в PowerShell-туле, не в Bash.
- После каждой правки прогоняй тесты в headless режиме (`npm run test`), актуализируй тесты под правки.
- После правок делай ВДУМЧИВОЕ ревью своего кода, чтобы не доводить до массового рефакторинга.
- Ты ОБЯЗАН следовать принципам SOLID, DRY и SRP при разработке
- Ты НИКОГДА не используешь магические числа. Только константы
- Константы должны быть локальными. 
  - Константы, которые используются только в одном файле - объявляй там же.
  - Константы, которые используются только в одной директории - объявляй на уровне директории.
  - Константы, которые нужны по всему проекту - в src/constants
  - По константам - рекомендация, не требования. Следуй здравому смыслу.
- При разработке фронтенда ВНИМАТЕЛЬНО следи, чтобы интерфейс не "прыгал"
  - Размеры кнопок при изменении состояния не должны меняться
  - Заголовки должны оставаться на том же месте 
  - Положение элементов почти не должно меняться
- Не запускай приложение сам
  - Как правило пользователь его уже запустил

## Тесты
- Ни один тест не должен флаковать
- Если тест НУ НИКАК не удается стабилизировать - уточни у пользователя, можно ли от него отказаться
- Не запускай тесты, пока пользователь не подтвердит корректность доработок
  - Сначала спрашиваешь у пользователя соответствует ли ожиданиям
  - Потом гоняешь тесты

## GitFlow 
- Разработка в отдельной feature-ветке
  - feature-ветку локально нужно вмержить в release-ветку
  - отводить feature-ветку надо ТОЛЬКО от release ветки
    - если на момент отведение release-ветки не было - надо ее создать
  - release ветка называется "release_{version}"
  - версию уточняешь у пользователя прежде чем создать release-ветку
  - пушить ничего не надо: пользователь сам запушит релиз ветку и вмержит в мастер
- Версия в package.json в release-ветке должна отражать версию release-ветки
- Перед мержем в релизную ветку обновляй CHANGELOG.md

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

**Симуляция (`src/game/`).** Единая сущность `Player` — и человек, и бот-соперник, и удалённый сетевой игрок —
композирует **инжектируемые** `Body` + `IWeapon` (`BeamWeapon`) + `IShield` (`Shield`) (Dependency Inversion).
У `Player` intent-методы `moveIntent/jump/aim/startFiring/activateShield` с вшитыми кулдаунами. Контроллеры
(`HumanController` — клавиши/мышь/камера; `BotController` — ИИ) дёргают **одни и те же** методы `Player`:
ИИ — это просто ещё один контроллер, как клавиатура. `Player` **не респавнит сам себя** — это делает `Match`.
`Match` владеет миром/игроками/контроллерами и является **единственным местом правил** (боёвка, респавн,
HUD-события, ритуал готовности, исключение самопопадания); его `update(dt)` — общий пульс.

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
`excludeEntityIds` исключает самого стрелка (`[p.id]`) — в строгом 1v1 единственный «чужой» это соперник,
friendly-fire невозможен (никаких команд). Капсула-коллайдер — только для движения. Меши, которые не должны
быть raycast-целью, помечаются `userData.noRaycast` сразу при создании.

**HUD/меню.** HUD — React/DOM-оверлей на `useGameHUD` (reducer в `App`); `Match` шлёт в него HUD-экшены.
Меню/комната — машина состояний экранов в `App` (menu/join/room/game) + hash-роутинг. Комната **строго 1v1, всегда
p2p**: создатель кода = хост (`HOST_ID=0`), вход по `#CODE` = клиент. `RoomSession` держит `hostEntry` + ОДИН
слот соперника (`opponent`, `OPPONENT_ID=1`) — бот XOR клиент; зашедший человек **вытесняет** бота, а НАЧАТЬ
заблокирована без соперника (`canStart`). Вход в матч — ритуал фаз `ready → countdown → live` (split-экран ГОТОВ +
3с отсчёт, движение/действия заморожены кроме камеры; бот-соперник авто-готов); фазой владеет `Match`. Для e2e —
debug-глобалы `__debugCamera/__debugTargetHitCount/__debugBotPos/__debugRole/__debugPlayerPos/__debugPhase/__debugReady/__debugForceLive/__debugLeave`.

**Сеть — P2P, host-authoritative (`src/net/`).** Одиночной игры нет; матч всегда хост + один соперник.
`Match` получает `role` (`host|client`): **хост** авторитетно симулирует обоих (свой человек + бот-соперник
`BotController` ЛИБО удалённый человек `RemoteInputController`) и шлёт **снапшоты** (позиция/визуальные
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