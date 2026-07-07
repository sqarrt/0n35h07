# colors-rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пара цветов `(primaryColor, reserveColor)` становится неизменным атрибутом внешности игрока: едет в ростере целиком, не подменяется при коллизиях, рендерится у всех пиров; у ботов появляется reserveColor.

**Architecture:** `RosterEntry` получает опциональное поле `reserveColor`; `RoomSession` перестаёт подменять цвет клиента (`assignColor` удаляется); `Match.buildPlayers` берёт цвет кольца из ростера вместо локальной опции `localReserveColor`; прокидка `reserveColor` через пропсы App→Game→Match умирает (DemoRecorder берёт его из ростера).

**Tech Stack:** TypeScript 6 (strict, `erasableSyntaxOnly` — без enum/parameter properties), Vitest (jsdom), Three.js 0.184.

**Спека:** `docs/superpowers/specs/2026-07-07-multiplayer-4p-mesh-design.md`, секция 4 и ветка 1 секции 11.

## Global Constraints

- Ветка `feature/colors-rework` создаётся ОТ `release_1.1.0` (GitFlow проекта). Ничего не пушить; мерж в release — только после одобрения пользователя.
- Юнит-тест одного файла: `npx vitest run --config vitest.config.ts tests/unit/<Файл>.test.ts`. Полный прогон `npm run test` (юниты+e2e) — ТОЛЬКО в Task 5 после подтверждения пользователя (правило проекта).
- Никаких магических чисел/цветов — только именованные константы или значения из тестовых фикстур.
- Коммиты с многострочным сообщением — через `git commit -F <файл>` (сообщение пишется bash-heredoc'ом), НЕ через PowerShell `@'...'@`.
- Комментарии в коде — на английском (стиль кодовой базы).

---

### Task 1: reserveColor у ботов (botAppearance)

**Files:**
- Modify: `src/game/botAppearance.ts`
- Test: `tests/unit/botAppearance.test.ts` (существует — дополнить)

**Interfaces:**
- Consumes: `PLAYER_COLORS` из `src/constants.ts`, `seededRng` (уже импортированы).
- Produces: `BotAppearance.reserveColor: string` — Task 2 использует `skin.reserveColor` в `makeBotEntry`.

- [ ] **Step 0: Создать ветку**

```bash
git checkout release_1.1.0 && git checkout -b feature/colors-rework
```

- [ ] **Step 1: Написать падающий тест**

Добавить в конец существующего describe в `tests/unit/botAppearance.test.ts` (импорт `PLAYER_COLORS` из `../../src/constants`, если его там ещё нет):

```ts
it('reserveColor: из палитры, не равен основному, детерминирован по имени', () => {
  const a = botAppearance('RA9')
  const b = botAppearance('RA9')
  expect(PLAYER_COLORS).toContain(a.reserveColor)
  expect(a.reserveColor).not.toBe(a.color)
  expect(b.reserveColor).toBe(a.reserveColor)
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/botAppearance.test.ts`
Expected: FAIL — `reserveColor` is `undefined` (нет в типе/объекте).

- [ ] **Step 3: Минимальная реализация**

В `src/game/botAppearance.ts` — поле в интерфейс и ПОСЛЕДНИЙ бросок rng (порядок критичен: reserveColor добирается после всех существующих полей, чтобы прежние поля для того же имени не изменились — внешность существующих ботов стабильна):

```ts
export interface BotAppearance {
  color:        string
  reserveColor: string   // second appearance color (ring etc.) — same pair semantics as a human profile
  ballModel:    BallModel
  windupStyle:  WindupStyle
  respawnStyle: RespawnStyle
  dashStyle:    DashStyle
  shieldStyle:  ShieldStyle
}
```

```ts
export function botAppearance(name: string): BotAppearance {
  const rng = seededRng(name)
  const color = pick(rng, PLAYER_COLORS)
  const look = {
    color,
    ballModel:    pick(rng, BALL_MODELS),
    windupStyle:  pick(rng, WINDUP_STYLES),
    respawnStyle: pick(rng, RESPAWN_STYLES),
    dashStyle:    pick(rng, DASH_STYLES),
    shieldStyle:  pick(rng, SHIELD_STYLES),
  }
  // reserve is drawn LAST: appended later than the other fields, so existing bots keep their look for the same name
  return { ...look, reserveColor: pick(rng, PLAYER_COLORS.filter(c => c !== color)) }
}
```

- [ ] **Step 4: Прогнать тесты бота (стабильность внешности — прежние тесты не должны шелохнуться)**

Run: `npx vitest run --config vitest.config.ts tests/unit/botAppearance.test.ts tests/unit/botPersonality.test.ts tests/unit/BotController.test.ts`
Expected: PASS (все).

- [ ] **Step 5: Commit**

```bash
git add src/game/botAppearance.ts tests/unit/botAppearance.test.ts
git commit -m "feat(colors): reserveColor у ботов — детерминированный, последним броском rng"
```

---

### Task 2: reserveColor в ростере, смерть assignColor (protocol + RoomSession)

**Files:**
- Modify: `src/net/protocol.ts:22-34` (RosterEntry)
- Modify: `src/net/RoomSession.ts:4,72,96-135` (import, hostEntry, onHello, assignColor, makeBotEntry)
- Test: `tests/unit/RoomSession.test.ts:61-76,101-112`

**Interfaces:**
- Consumes: `BotAppearance.reserveColor` (Task 1); `Hello.reserveColor` (уже существует в протоколе, `protocol.ts:35`).
- Produces: `RosterEntry.reserveColor?: string` — Task 3 читает `e.reserveColor` в `Match.buildPlayers`, Task 4 — в `DemoRecorder`.

- [ ] **Step 1: Переписать тесты цветов (падающие)**

В `tests/unit/RoomSession.test.ts` ЗАМЕНИТЬ describe `'RoomSession — color assignment by host'` (строки 61-76) на:

```ts
describe('RoomSession — личные цвета не подменяются', () => {
  it('клиент с тем же primary, что у хоста, СОХРАНЯЕТ его (коллизия допустима)', () => {
    const { hostView } = handshake({ ...GUEST, primaryColor: HOST.primaryColor })
    expect(hostView.roster.find(r => r.id === 1)!.color).toBe(HOST.primaryColor)
  })
  it('пара цветов клиента едет в ростер целиком', () => {
    const { hostView } = handshake(GUEST)
    const clientEntry = hostView.roster.find(r => r.id === 1)!
    expect(clientEntry.color).toBe(GUEST.primaryColor)
    expect(clientEntry.reserveColor).toBe(GUEST.reserveColor)
  })
  it('запись хоста несёт его reserveColor', () => {
    const { hostView } = handshake(GUEST)
    expect(hostView.roster.find(r => r.id === 0)!.reserveColor).toBe(HOST.reserveColor)
  })
})
```

В тесте бота (describe около строки 101, `'addBot assigns botAppearance(name) cosmetics...'`) ЗАМЕНИТЬ ассерт `expect(bot.color).not.toBe(HOST.primaryColor)` на точные (skin уже вычисляется в тесте через `botAppearance(name)`; если нет — добавить):

```ts
expect(bot.color).toBe(skin.color)                 // exactly the skin color — no collision dodging
expect(bot.reserveColor).toBe(skin.reserveColor)   // the pair ships whole
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run --config vitest.config.ts tests/unit/RoomSession.test.ts`
Expected: FAIL — `reserveColor` undefined в ростере; клиент с цветом хоста получает reserve (старое поведение).

- [ ] **Step 3: Реализация**

`src/net/protocol.ts` — в `RosterEntry` после `color`:

```ts
  reserveColor?: string        // second appearance color (planet ring today; future models may use it differently); absent → color
```

`src/net/RoomSession.ts`:

1. Строка 72, `hostEntry`: после `color: profile.primaryColor` добавить `reserveColor: profile.reserveColor,`.
2. Строка 103, `onHello`: заменить `color: this.assignColor(hello.primaryColor, hello.reserveColor)` на `color: hello.primaryColor, reserveColor: hello.reserveColor`.
3. УДАЛИТЬ метод `assignColor` целиком (строки 110-116, вместе с docstring).
4. `makeBotEntry` (строка ~131): заменить `color: this.assignColor(skin.color, skin.color),` на `color: skin.color, reserveColor: skin.reserveColor,`.
5. Строка 4: убрать `PLAYER_COLORS` из импорта constants (единственным потребителем был `assignColor`).

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run --config vitest.config.ts tests/unit/RoomSession.test.ts tests/unit/NetSession.test.ts tests/unit/protocol.test.ts`
Expected: PASS. (Если `protocol.test.ts` не существует — прогнать только первые два.)

- [ ] **Step 5: Commit**

```bash
git add src/net/protocol.ts src/net/RoomSession.ts tests/unit/RoomSession.test.ts
git commit -m "feat(colors): пара цветов в RosterEntry, удалён assignColor — личный цвет не зависит от сетевой роли"
```

---

### Task 3: Match рендерит пару цветов из ростера (уходит localReserveColor)

**Files:**
- Modify: `src/game/Match.ts:92,217-218` (MatchOptions, buildPlayers)
- Modify: `src/Game.tsx:78` (только вызов Match — проп пока остаётся для DemoRecorder, его убирает Task 4)
- Test: `tests/unit/Match.test.ts`

**Interfaces:**
- Consumes: `RosterEntry.reserveColor` (Task 2).
- Produces: `MatchOptions` БЕЗ поля `localReserveColor` (Task 4 полагается на то, что Match его больше не принимает).

- [ ] **Step 1: Написать падающий тест**

В `tests/unit/Match.test.ts` добавить describe (использует уже импортированные THREE/Match/RosterEntry и хелперы lockPointer/unlockPointer):

```ts
describe('Match — пара цветов из ростера', () => {
  beforeEach(lockPointer)
  afterEach(unlockPointer)

  it('кольцо planet-модели ремоутного игрока красится его reserveColor из ростера', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', kind: 'human' },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'passive', ballModel: 'planet', reserveColor: '#fd4' },
    ]
    const match = new Match({
      scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
      keys: { current: { forward: false, back: false, left: false, right: false } } as any,
      dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster },
    })
    // Collect every uColor uniform in the bot's visuals: the ring's one must carry the roster reserveColor.
    const uColors: string[] = []
    match.bots[0].bodyGroup.traverse(o => {
      const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
      if (mat?.uniforms?.uColor) uColors.push(mat.uniforms.uColor.value.getHexString())
    })
    expect(uColors).toContain('ffdd44')   // '#fd4' → ring painted with the roster reserve color
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/Match.test.ts`
Expected: FAIL — `uColors` содержит цвет кольца = основному `'55aaff'`, но не `'ffdd44'` (сейчас кольцо ремоутного = его основной цвет).

- [ ] **Step 3: Реализация**

`src/game/Match.ts`:

1. УДАЛИТЬ строку 92 (`localReserveColor?: string ...`) из `MatchOptions`.
2. Строки 217-218 в `buildPlayers` заменить на:

```ts
      // Planet ring: the "second" appearance color ships in the roster for EVERY player; absent (older peer/demo) → own color.
      const ringColor = e.reserveColor ?? e.color
```

`src/Game.tsx`, строка 78: удалить строку `localReserveColor: reserveColor,` из объекта опций Match (проп `reserveColor` остаётся — им ещё пользуется DemoRecorder на строке 129 до Task 4).

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run --config vitest.config.ts tests/unit/Match.test.ts tests/unit/MatchNet.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/Match.ts src/Game.tsx tests/unit/Match.test.ts
git commit -m "feat(colors): кольцо каждого игрока — из reserveColor ростера; MatchOptions.localReserveColor удалён"
```

---

### Task 4: DemoRecorder берёт reserveColor из ростера; смерть проп-цепочки App→Game

**Files:**
- Modify: `src/game/demo/DemoRecorder.ts:27-34`
- Modify: `src/Game.tsx:40,58,129`
- Modify: `src/App.tsx:138,154,165,1127`
- Test: Create `tests/unit/DemoRecorder.test.ts`

**Interfaces:**
- Consumes: `RosterEntry.reserveColor` (Task 2); `MatchOptions` без `localReserveColor` (Task 3).
- Produces: `DemoRecorder` constructor meta БЕЗ поля `reserveColor`: `{ roster: RosterEntry[]; mapId: MapId; durationMs: number; localId: number }`. Формат demo-файла (`demoTypes.ts`) НЕ меняется — `build()` по-прежнему пишет `reserveColor` (совместимость воспроизведения).

- [ ] **Step 1: Написать падающий тест**

Создать `tests/unit/DemoRecorder.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DemoRecorder } from '../../src/game/demo/DemoRecorder'
import { DEFAULT_MAP_ID } from '../../src/constants'
import type { RosterEntry } from '../../src/net/protocol'

describe('DemoRecorder', () => {
  it('reserveColor демо берётся из ростерной записи локального игрока', () => {
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', reserveColor: '#fa4', kind: 'human' },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot' },
    ]
    const rec = new DemoRecorder({ roster, mapId: DEFAULT_MAP_ID, durationMs: 60_000, localId: 0 })
    expect(rec.build().reserveColor).toBe('#fa4')
  })

  it('без reserveColor в ростере (старый пир) — фолбэк на основной цвет', () => {
    const roster: RosterEntry[] = [{ id: 0, name: 'You', color: '#4af', kind: 'human' }]
    const rec = new DemoRecorder({ roster, mapId: DEFAULT_MAP_ID, durationMs: 60_000, localId: 0 })
    expect(rec.build().reserveColor).toBe('#4af')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/DemoRecorder.test.ts`
Expected: FAIL — компиляция/тип: meta требует поле `reserveColor` (старая сигнатура).

- [ ] **Step 3: Реализация**

`src/game/demo/DemoRecorder.ts` (строки 27-34): убрать `reserveColor` из meta-типа конструктора и вычислить из ростера:

```ts
  constructor(meta: { roster: RosterEntry[]; mapId: MapId; durationMs: number; localId: number }) {
    // ...existing assignments...
    const me = meta.roster.find(r => r.id === meta.localId)
    this.reserveColor = me?.reserveColor ?? me?.color ?? ''   // '' never happens (local id is always in the roster)
  }
```

(Поле `private readonly reserveColor` и `build()` — без изменений: формат демо стабилен.)

`src/Game.tsx`:
1. Строка 40: удалить `reserveColor: string` из `GameProps`.
2. Строка 58: удалить `reserveColor` из деструктуризации `GameImpl`.
3. Строка 129: в вызове `new DemoRecorder({...})` удалить `reserveColor`.

`src/App.tsx`:
1. Строка ~138: удалить `reserveColor: string` из `GameCanvasProps`.
2. Строка ~154: удалить `reserveColor` из деструктуризации `GameCanvas`.
3. Строка ~165: удалить `reserveColor={reserveColor}`.
4. Строка ~1127: удалить `reserveColor={profile.reserveColor}`.

- [ ] **Step 4: Прогнать тесты + типы**

Run: `npx vitest run --config vitest.config.ts tests/unit/DemoRecorder.test.ts && npx tsc -b --noEmit`
Expected: PASS; tsc без ошибок (все потребители пропа зачищены).

- [ ] **Step 5: Commit**

```bash
git add src/game/demo/DemoRecorder.ts src/Game.tsx src/App.tsx tests/unit/DemoRecorder.test.ts
git commit -m "refactor(colors): DemoRecorder берёт reserveColor из ростера — проп-цепочка App→Game удалена"
```

---

### Task 5: Зачистка, полная верификация, чекпоинт пользователя

**Files:**
- Modify: только то, что найдёт зачистка (ожидаемо — ничего).

- [ ] **Step 1: Grep-зачистка остатков**

Run: `grep -rn "assignColor\|localReserveColor" src/ tests/`
Expected: пусто. Любая находка — починить и закоммитить с пометкой `chore(colors): зачистка`.

- [ ] **Step 2: Типы и линт**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: без ошибок.

- [ ] **Step 3: Все юниты**

Run: `npm run test:unit`
Expected: PASS полностью. Упавшие тесты, ссылающиеся на старое поведение подмены цвета, — обновить по образцу Task 2 (и закоммитить вместе с фиксом).

- [ ] **Step 4: ЧЕКПОИНТ — показать пользователю**

СТОП: доложить пользователю диффстат и суть изменений, спросить, соответствует ли ожиданиям. Полный прогон `npm run test` (юниты+e2e) — только после его подтверждения (правило проекта). E2e-тесты цветов не имеют (grep `tests/appearance.spec.ts` по reserveColor пуст), но полный прогон обязателен перед мержем.

- [ ] **Step 5: Полный прогон и финальный коммит (после подтверждения)**

Run: `npm run test`
Expected: PASS (юниты + Playwright headless). Примечание: боевые двухвкладочные спеки флакают сами по себе (~40-60%) — одиночный флак перегнать, не чинить вслепую.

- [ ] **Step 6: Обновить CHANGELOG.md и предложить мерж**

Добавить запись в `CHANGELOG.md` (раздел под текущий release 1.1.0): «Цвета игроков: пара primary+reserve — неизменный атрибут внешности; подмена цвета при коллизии удалена; у ботов появился второй цвет». Мерж `feature/colors-rework` → `release_1.1.0` — только после явного одобрения пользователя.

```bash
git add CHANGELOG.md
git commit -m "docs: changelog — переработка цветов игроков"
```
