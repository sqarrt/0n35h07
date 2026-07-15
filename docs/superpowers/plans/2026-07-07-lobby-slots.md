# lobby-slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Режимы 1v1 / 2v2 / FFA (2–4): слоты в лобби, команды-пресеты, пересадка, спавн-правила, плашки над игроками, N-игроковый счёт/исход — на текущей звезде (хост-авторитет; меш — следующая ветка).

**Architecture:** Режим — пресет лобби (`src/game/modes.ts`): число слотов, команда-по-слоту, canStart, спавн-правило. Симуляция всегда командная (`Player.team`), ветвлений по режиму не имеет. `RoomSession` переходит с «host + один opponent» на массив слотов; протокол получает `mode` в Assign, `setSlot` и FFA-спавны в `Start`. HUD/лобби — функциональная адаптация (визуальный редизайн — отдельно, frontend-design).

**Tech Stack:** TypeScript 6 (strict, `erasableSyntaxOnly` — без enum), Vitest + LoopbackNet, Playwright (BroadcastChannelNet), Three.js.

**Спека:** `docs/superpowers/specs/2026-07-07-multiplayer-4p-mesh-design.md` (ревизия 2), ветка 2 секции 11.

## Global Constraints

- Ветка `feature/lobby-slots` создаётся ОТ `release_1.1.0`. Ничего не пушить; мерж — после одобрения пользователя.
- Юнит-тест файла: `npx vitest run --config vitest.config.ts tests/unit/<Файл>.test.ts`. Полный `npm run test` — ТОЛЬКО в финальном чекпоинте после подтверждения пользователя.
- Никаких магических чисел — именованные константы (локально файла / директории / src/constants по месту использования).
- `erasableSyntaxOnly`: никаких enum/namespace/parameter properties.
- Комментарии в коде — на английском. Многострочные коммиты — heredoc + `git commit -F`.
- i18n: каждая новая строка UI добавляется в тип `Dict` (`src/i18n/dict.ts`) и ВСЕ 10 локалей (`src/i18n/locales/{en,ru,de,es,fr,it,pl,ptBR,tr,zhCN}.ts`).
- Обратная совместимость вырожденного 1v1: существующее поведение (спавны, HUD-вид, отсутствие плашек) сохраняется пиксель-в-пиксель; старые юнит-тесты Match с ростером на 2 без `mode` должны проходить без правок смысла.
- Scope-границы: транспорт/NetSession/лаг-комп НЕ трогаем (меш — ветка 3); Steam Rust cap НЕ трогаем (ветка 4); карты/редактор НЕ трогаем (спека §8); отложенные правки из плана colors-rework (ballArt в лобби-заднике и пр.) — НЕ здесь.

---

### Task 1: Модуль режимов (`src/game/modes.ts`)

**Files:**
- Create: `src/game/modes.ts`
- Modify: `src/constants.ts` (TEAM_COLORS, NAMEPLATE_NEUTRAL_COLOR — рядом с PLAYER_COLORS:161)
- Test: Create `tests/unit/modes.test.ts`

**Interfaces:**
- Produces: `type GameMode = '1v1' | '2v2' | 'ffa'`; `MODE_SLOT_COUNT: Record<GameMode, number>`; `teamOfSlot(mode: GameMode, slot: number): number`; `canStartFor(mode: GameMode, occupiedCount: number): boolean`; константы `TEAM_COLORS: [string, string]`, `NAMEPLATE_NEUTRAL_COLOR: string`. Все последующие задачи используют их.

- [ ] **Step 0: Ветка**

```bash
git checkout release_1.1.0 && git checkout -b feature/lobby-slots
```

- [ ] **Step 1: Падающий тест** — `tests/unit/modes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MODE_SLOT_COUNT, teamOfSlot, canStartFor } from '../../src/game/modes'

describe('modes', () => {
  it('slot counts per mode', () => {
    expect(MODE_SLOT_COUNT['1v1']).toBe(2)
    expect(MODE_SLOT_COUNT['2v2']).toBe(4)
    expect(MODE_SLOT_COUNT['ffa']).toBe(4)
  })
  it('1v1/ffa: every slot is its own team', () => {
    expect([0, 1].map(s => teamOfSlot('1v1', s))).toEqual([0, 1])
    expect([0, 1, 2, 3].map(s => teamOfSlot('ffa', s))).toEqual([0, 1, 2, 3])
  })
  it('2v2: slots 0-1 team 0, slots 2-3 team 1', () => {
    expect([0, 1, 2, 3].map(s => teamOfSlot('2v2', s))).toEqual([0, 0, 1, 1])
  })
  it('canStart: 1v1 needs 2, 2v2 needs all 4, ffa needs >=2', () => {
    expect(canStartFor('1v1', 1)).toBe(false); expect(canStartFor('1v1', 2)).toBe(true)
    expect(canStartFor('2v2', 3)).toBe(false); expect(canStartFor('2v2', 4)).toBe(true)
    expect(canStartFor('ffa', 1)).toBe(false); expect(canStartFor('ffa', 2)).toBe(true); expect(canStartFor('ffa', 4)).toBe(true)
  })
})
```

- [ ] **Step 2: Убедиться, что падает** — `npx vitest run --config vitest.config.ts tests/unit/modes.test.ts` → FAIL (модуля нет).

- [ ] **Step 3: Реализация** — `src/game/modes.ts`:

```ts
/** Game mode is a LOBBY preset (slot count, team layout, start gate, spawn rule).
 *  The simulation itself is always team-based and has NO branching on the mode. */
export type GameMode = '1v1' | '2v2' | 'ffa'

export const GAME_MODES: GameMode[] = ['1v1', '2v2', 'ffa']

export const MODE_SLOT_COUNT: Record<GameMode, number> = { '1v1': 2, '2v2': 4, 'ffa': 4 }

const FFA_MIN_PLAYERS = 2   // an FFA room may start as a pair (degenerate duel with random spawns)
const TEAM_SIZE_2V2 = 2     // slots 0-1 → team 0, slots 2-3 → team 1

/** Team of a slot under the mode's preset. 1v1/FFA: everyone is their own team. */
export function teamOfSlot(mode: GameMode, slot: number): number {
  return mode === '2v2' ? Math.floor(slot / TEAM_SIZE_2V2) : slot
}

/** Start gate: 1v1 — both slots, 2v2 — full teams, FFA — at least a pair. */
export function canStartFor(mode: GameMode, occupiedCount: number): boolean {
  if (mode === 'ffa') return occupiedCount >= FFA_MIN_PLAYERS
  return occupiedCount === MODE_SLOT_COUNT[mode]
}
```

В `src/constants.ts` после `PLAYER_COLORS` (строка 161):

```ts
// Team identity lives ONLY on nameplates (2v2): fixed pair, deliberately outside PLAYER_COLORS semantics.
export const TEAM_COLORS: [string, string] = ['#37f', '#f53']
export const NAMEPLATE_NEUTRAL_COLOR = '#ccc'   // FFA plates: everyone is an enemy, color codes nothing
```

- [ ] **Step 4: Прогнать** → PASS.
- [ ] **Step 5: Commit** — `feat(modes): пресеты режимов 1v1/2v2/ffa — слоты, команды, canStart`

---

### Task 2: Спавн-правила (`src/game/spawns.ts`)

**Files:**
- Create: `src/game/spawns.ts`
- Modify: `src/constants.ts` (константы кучки/дистанции)
- Test: Create `tests/unit/spawns.test.ts`

**Interfaces:**
- Consumes: `GameMode`, `teamOfSlot` (Task 1); тип `Vec3` из `src/net/protocol`; `SPAWN_HALF` из constants.
- Produces:
  - `spawnPositionsFor(mode: GameMode, slots: number[], mapSpawns: readonly [Vec3, Vec3], ffaSpawns?: Vec3[]): Map<number, Vec3>` — slot id → позиция.
  - `genFfaSpawns(count: number, y: number, rng?: () => number): Vec3[]` — для хоста при старте FFA.

- [ ] **Step 1: Падающий тест** — `tests/unit/spawns.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { spawnPositionsFor, genFfaSpawns } from '../../src/game/spawns'
import { FFA_SPAWN_MIN_DIST, SPAWN_HALF } from '../../src/constants'
import type { Vec3 } from '../../src/net/protocol'

const MAP_SPAWNS: [Vec3, Vec3] = [[0, 1, 5], [0, 1, -5]]
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2])

describe('spawnPositionsFor', () => {
  it('1v1: slot 0 → point 0, slot 1 → point 1 (exactly the current game)', () => {
    const m = spawnPositionsFor('1v1', [0, 1], MAP_SPAWNS)
    expect(m.get(0)).toEqual([0, 1, 5])
    expect(m.get(1)).toEqual([0, 1, -5])
  })
  it('2v2: team 0 clusters at point 0, team 1 at point 1; no two positions coincide', () => {
    const m = spawnPositionsFor('2v2', [0, 1, 2, 3], MAP_SPAWNS)
    for (const s of [0, 1]) expect(dist(m.get(s)!, MAP_SPAWNS[0])).toBeLessThan(3)
    for (const s of [2, 3]) expect(dist(m.get(s)!, MAP_SPAWNS[1])).toBeLessThan(3)
    const all = [...m.values()]
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) expect(dist(all[i], all[j])).toBeGreaterThan(0.5)
  })
  it('ffa: uses the provided positions in slot order', () => {
    const ffa: Vec3[] = [[1, 1, 1], [2, 1, 2], [3, 1, 3]]
    const m = spawnPositionsFor('ffa', [0, 2, 3], MAP_SPAWNS, ffa)
    expect(m.get(0)).toEqual([1, 1, 1]); expect(m.get(2)).toEqual([2, 1, 2]); expect(m.get(3)).toEqual([3, 1, 3])
  })
})

describe('genFfaSpawns', () => {
  it('respects the min pairwise distance and arena bounds (seeded rng)', () => {
    let s = 42; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647
    const pts = genFfaSpawns(4, 1, rng)
    expect(pts).toHaveLength(4)
    for (const p of pts) { expect(Math.abs(p[0])).toBeLessThanOrEqual(SPAWN_HALF); expect(Math.abs(p[2])).toBeLessThanOrEqual(SPAWN_HALF); expect(p[1]).toBe(1) }
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(dist(pts[i], pts[j])).toBeGreaterThanOrEqual(FFA_SPAWN_MIN_DIST)
  })
})
```

- [ ] **Step 2: FAIL** (модуля/констант нет).
- [ ] **Step 3: Реализация.** В `src/constants.ts` рядом с `SPAWN_HALF` (:201):

```ts
export const SPAWN_CLUSTER_OFFSETS: ReadonlyArray<readonly [number, number]> = [[-0.9, 0], [0.9, 0]]  // XZ offsets inside a 2v2 team cluster (keep capsules apart)
export const FFA_SPAWN_MIN_DIST = 6      // min pairwise distance between FFA start positions
```

`src/game/spawns.ts`:

```ts
import type { Vec3 } from '../net/protocol'
import type { GameMode } from './modes'
import { teamOfSlot } from './modes'
import { SPAWN_CLUSTER_OFFSETS, FFA_SPAWN_MIN_DIST, SPAWN_HALF } from '../constants'

const FFA_SPAWN_MAX_TRIES = 200   // rejection-sampling cap; after it, accept the best candidate found

/** Start positions by slot. 1v1 — the two map points as today; 2v2 — team clusters at the two points;
 *  FFA — host-generated positions (shipped in Start) applied in slot order. */
export function spawnPositionsFor(mode: GameMode, slots: number[], mapSpawns: readonly [Vec3, Vec3], ffaSpawns?: Vec3[]): Map<number, Vec3> {
  const out = new Map<number, Vec3>()
  if (mode === 'ffa' && ffaSpawns) {
    slots.forEach((slot, i) => out.set(slot, ffaSpawns[i] ?? mapSpawns[i % 2]))
    return out
  }
  if (mode === '2v2') {
    const seen = [0, 0]   // members already placed per team → offset index
    for (const slot of slots) {
      const team = teamOfSlot(mode, slot)
      const base = mapSpawns[team]
      const [ox, oz] = SPAWN_CLUSTER_OFFSETS[seen[team]++ % SPAWN_CLUSTER_OFFSETS.length]
      out.set(slot, [base[0] + ox, base[1], base[2] + oz])
    }
    return out
  }
  // 1v1 (and FFA fallback without positions): slot 0 → point 0, others → point 1 — exactly the pre-modes rule.
  for (const slot of slots) out.set(slot, mapSpawns[slot === 0 ? 0 : 1])
  return out
}

/** Random FFA start positions: inside the arena square, min pairwise distance. Runs on the LOBBY CREATOR only;
 *  the result ships in the Start message so every peer gets identical positions without a shared RNG. */
export function genFfaSpawns(count: number, y: number, rng: () => number = Math.random): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i < count; i++) {
    let best: Vec3 = [0, y, 0]; let bestScore = -1
    for (let t = 0; t < FFA_SPAWN_MAX_TRIES; t++) {
      const c: Vec3 = [(rng() * 2 - 1) * SPAWN_HALF, y, (rng() * 2 - 1) * SPAWN_HALF]
      const near = Math.min(Infinity, ...pts.map(p => Math.hypot(c[0] - p[0], c[2] - p[2])))
      if (near >= FFA_SPAWN_MIN_DIST || near > bestScore) { best = c; bestScore = near }
      if (near >= FFA_SPAWN_MIN_DIST || pts.length === 0) break
    }
    pts.push(best)
  }
  return pts
}
```

(Внимание: `Math.min(Infinity, ...[])` = Infinity → первая точка проходит сразу.)

- [ ] **Step 4: PASS** (+ прогнать `tests/unit/maps.spec`-аналоги не нужны — карты не тронуты).
- [ ] **Step 5: Commit** — `feat(spawns): спавн-правила режимов — 1v1 как было, 2v2 кучки, FFA рандом с мин-дистанцией`

---

### Task 3: Протокол — mode, setSlot, FFA-спавны в Start

**Files:**
- Modify: `src/net/protocol.ts:13` (NET_TAGS), `:36` (Assign), `:39` (Start)
- Test: `tests/unit/protocol.test.ts` (дополнить)

**Interfaces:**
- Consumes: `GameMode` (Task 1).
- Produces: `Assign { …; mode: GameMode }`; `Start { durationMs; mapId; spawns?: Vec3[] }`; `SetSlotMsg { slot: number }`; тег `'setSlot'` (7 байт ≤ 12 ✓). RoomSession (Task 4) и App (Task 8) полагаются на эти поля.

- [ ] **Step 1: Падающий тест** — в `tests/unit/protocol.test.ts` добавить компайл-тест форм:

```ts
it('mode/setSlot/ffa-spawns shapes', () => {
  const a: Assign = { yourId: 2, roster: [], durationMin: 5, mapId: 'os_arena' as MapId, ready: [], mode: '2v2' }
  const s: Start = { durationMs: 60000, mapId: 'os_arena' as MapId, spawns: [[1, 1, 1]] }
  const m: SetSlotMsg = { slot: 3 }
  expect(a.mode).toBe('2v2'); expect(s.spawns![0][1]).toBe(1); expect(m.slot).toBe(3)
  expect(NET_TAGS).toContain('setSlot')
})
```
(импорты типов поправить по месту; тест падает на компиляции.)

- [ ] **Step 2: FAIL** → **Step 3: Реализация** в `protocol.ts`:
  - `NET_TAGS`: добавить `'setSlot'`.
  - `Assign` += `mode: GameMode` (импорт `import type { GameMode } from '../game/modes'`).
  - `Start` += `spawns?: Vec3[]  // FFA start positions by occupied-slot order (creator-generated → identical on every peer)`.
  - Новый интерфейс: `export interface SetSlotMsg { slot: number }  // client → host: move me to this free slot (2v2 team change)`.
- [ ] **Step 4: PASS** → **Step 5: Commit** — `feat(protocol): mode в Assign, setSlot, FFA-спавны в Start`

---

### Task 4: RoomSession — слоты и режимы

Самая объёмная задача. `src/net/RoomSession.ts` переписывается со «single opponent» на массив слотов, сохраняя внешние сигнатуры, где возможно (App-чурн минимизируется).

**Files:**
- Modify: `src/net/RoomSession.ts` (весь класс), `src/constants.ts` (пометить `OPPONENT_ID` как deprecated-для-меню, см. Step 3.8)
- Test: `tests/unit/RoomSession.test.ts` (существующие правятся + новые describe)

**Interfaces:**
- Consumes: `GameMode, MODE_SLOT_COUNT, canStartFor` (Task 1), `genFfaSpawns` (Task 2), `Assign/Start/SetSlotMsg` (Task 3), `MAPS` (для y-координаты FFA-спавнов).
- Produces (новый контракт для App/Game):
  - `RoomView { roster; slots: (RosterEntry | null)[]; mode: GameMode; localPlayerId; isHost; connected; foundHost; canStart; durationMin; mapId; mapSel; durationSel; ready }`
  - `setMode(mode: GameMode): void` (host; no-op если занятых слотов больше нового лимита)
  - `requestSlot(slot: number): void` (client → шлёт `setSlot`; host — локальная пересадка)
  - `addBot(difficulty?, name?, slot?: number)` — в указанный/первый свободный слот
  - `removeBot(slot: number)`, `setBotName(slot, name)`, `setBotDifficulty(d)` — на ВСЕХ ботов (глобальный пикер, UX v1)
  - `start()` — для FFA генерит `spawns` через `genFfaSpawns` и кладёт в `Start`
  - `onStart(cb: (durationMs, mapId, mode: GameMode, spawns?: Vec3[]) => void)`
  - `netConfig(): { localId; roster; mode }`
  - `hostPeerToPlayer(): Map<PeerId, number>` — все подключённые клиенты

- [ ] **Step 1: Падающие тесты** — в `tests/unit/RoomSession.test.ts` новый describe (хелпер `handshake` уже есть; для 3 пиров используется `createLoopbackPair`... ПРОВЕРИТЬ: если LoopbackNet поддерживает только пары — для мультиклиентских кейсов создать хост-сессию и слать `hello` вторым клиентом через вторую пару НЕЛЬЗЯ; тогда мультиклиент тестируем через два независимых `hello` невозможно — в этом случае юнит-кейсы ограничиваются host+1 client+боты, а мультиклиент уходит в e2e. Проверить `src/net/LoopbackNet.ts`: есть ли `createLoopbackHub`/N-пиров; если нет — добавить `createLoopbackHub(ids: string[])` мини-задачей внутри этого Task с собственным тестом):

```ts
describe('RoomSession — режимы и слоты', () => {
  it('дефолтный режим 1v1: 2 слота, поведение как раньше', () => {
    const { hostView } = handshake(GUEST)
    expect(hostView.mode).toBe('1v1')
    expect(hostView.slots).toHaveLength(2)
    expect(hostView.canStart).toBe(true)
  })
  it('setMode(2v2): 4 слота, canStart только при полных составах', () => {
    const { host, hostView: v0 } = handshake(GUEST)   // host + 1 human
    host.setMode('2v2')
    let v = host.view()
    expect(v.slots).toHaveLength(4)
    expect(v.canStart).toBe(false)
    host.addBot('normal'); host.addBot('normal')
    expect(host.view().canStart).toBe(true)
  })
  it('setMode вниз заблокирован, пока занятых больше лимита', () => {
    const { host } = handshake(GUEST)
    host.setMode('ffa'); host.addBot('normal'); host.addBot('normal')   // 4 занятых
    host.setMode('1v1')
    expect(host.view().mode).toBe('ffa')   // no-op
  })
  it('addBot(slot): бот садится в указанный слот; removeBot(slot) освобождает', () => {
    const { host } = handshake(GUEST)
    host.setMode('2v2')
    host.addBot('normal', undefined, 3)
    expect(host.view().slots[3]?.kind).toBe('bot')
    host.removeBot(3)
    expect(host.view().slots[3]).toBeNull()
  })
  it('ffa: canStart от 2 занятых', () => {
    const [a] = createLoopbackPair('H', 'C')
    const solo = new RoomSession(a, 'host', 'AB12', HOST)
    solo.setMode('ffa')
    expect(solo.view().canStart).toBe(false)
    solo.addBot('normal')
    expect(solo.view().canStart).toBe(true)
  })
  it('host requestSlot: пересадка в свободный слот, ready сохраняется за id нового слота корректно (сбрасывается)', () => {
    const [a] = createLoopbackPair('H2', 'C2')
    const solo = new RoomSession(a, 'host', 'AB12', HOST)
    solo.setMode('2v2')
    solo.requestSlot(2)
    expect(solo.view().slots[2]?.name).toBe(HOST.name)
    expect(solo.view().localPlayerId).toBe(2)
  })
  it('start в ffa кладёт spawns в onStart по числу занятых', () => {
    const { host, client } = handshake(GUEST)
    host.setMode('ffa'); host.addBot('normal')
    let got: Vec3[] | undefined
    client.onStart((_ms, _map, _mode, spawns) => { got = spawns })
    host.setLocalReady(true)   // люди ready → бот авто → старт
    // клиентская ready: у client вызвать setLocalReady(true) ДО host
    expect(got).toHaveLength(3)
  })
})
```
(Точные ready-хореографии подогнать по фактическому `maybeStart`; принцип — старт наступает при `canStart && все занятые ready`.)

Существующие тесты правятся: `canStart` теперь `canStartFor(mode, occupied)`; «repeated addBot — no-op» → в 1v1 второй `addBot` не влезает (слотов нет) — семантика та же; `hostPeerToPlayer` для одного клиента возвращает Map с его слотом.

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализация** (ядро → показываю ключевые куски; остальной класс — механический перенос):

3.1 Состояние вместо `hostEntry/opponent/clientPeer`:
```ts
private mode: GameMode = '1v1'
private slots: (RosterEntry | null)[] = [null, null]        // length = MODE_SLOT_COUNT[mode]
private peerBySlot = new Map<number, PeerId>()              // host: which peer occupies a human slot
```
Конструктор host: `this.slots[0] = { id: 0, name: profile.name, ... }` (бывший hostEntry, id всегда = индекс слота). Клиентская сторона хранит `slots` из Assign.

3.2 `setMode(m)`: только host; `occupied() > MODE_SLOT_COUNT[m]` → no-op (лог-warn); иначе пересобрать массив длиной нового лимита, ПЕРЕНОСЯ занятые записи на те же индексы (индексы за пределами нового лимита не существуют — потому и гейт), `readyIds` пересечь с новыми id, broadcast.

3.3 `onHello`: `const slot = this.slots.findIndex(s => s === null)`; `slot < 0` → warn `hello_reject_full`, return. Посадить `{ id: slot, ... }`, `peerBySlot.set(slot, from)`, resolveAgainst, broadcast. Повторный hello от УЖЕ сидящего peer (ретрай) → просто re-send Assign (найти его слот по peerBySlot).

3.4 `net.on('setSlot')` (host): найти слот отправителя по peer; целевой занят → игнор; иначе переместить запись (id = новый индекс слота!), обновить peerBySlot, `readyIds.delete(старый id)`, broadcast. `requestSlot(slot)` на клиенте — `net.broadcast('setSlot', { slot })`; на хосте — локальная пересадка тем же кодом.

3.5 Боты: `addBot(difficulty='normal', name?, slot?)` → целевой = `slot ?? firstFree`; `makeBotEntry(name, difficulty, slotId)`; `readyIds.add(slotId)`. `removeBot(slot)`; `setBotName(slot, name)`; `setBotDifficulty(d)` — применить ко всем `kind==='bot'`.

3.6 `sendAssign(peer)`: `yourId` = слот этого пира, `mode: this.mode`. `broadcastRoster()`: разослать Assign КАЖДОМУ подключённому пиру (итерация по peerBySlot). `onAssign`: сохранить `slots` реконструкцией из `a.roster` + `a.mode` (`slots[i] = roster.find(r => r.id === i) ?? null`).

3.7 `start()`: gate `canStartFor(this.mode, occupied)`;
```ts
const spawns = this.mode === 'ffa'
  ? genFfaSpawns(this.occupiedIds().length, MAPS[this.mapId].spawns[0][1])
  : undefined
this.net.broadcast('start', { durationMs, mapId: this.mapId, spawns } satisfies Start)
this.startCb(durationMs, this.mapId, this.mode, spawns)
```
`maybeStart()`: `canStart && occupiedIds().every(id => readyIds.has(id))`.

3.8 `roster() = slots.filter(Boolean)`; `view()` += `slots`, `mode`; `canStart = isHost && canStartFor(mode, occupied)`. `hostPeerToPlayer()` — из peerBySlot (invert). `netConfig()` += `mode`. Убрать импорт `OPPONENT_ID` из RoomSession; в `src/constants.ts` к `OPPONENT_ID` дописать комментарий `// menu-backdrop legacy: slot 1; room/match logic must not use it` (полное удаление — после правки бэкдропа в Task 8).

3.9 `onReady`(host): id по peerBySlot отправителя. `onPeerLeave`(host): найти слот по peer → освободить, `readyIds.delete`, broadcast.

- [ ] **Step 4: Прогнать** `RoomSession.test.ts`, `NetSession.test.ts`, `protocol.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(room): RoomSession на слотах — режимы, пересадка setSlot, боты по слотам, FFA-спавны в Start`

---

### Task 5: Match — команды, N-исход, спавны, цель бота, uход игрока

**Files:**
- Modify: `src/game/Match.ts` (:84-100 MatchOptions, :204-266 buildPlayers, :250-256 BotController, :274 excludeIds комментарий, :534-586 resolveHit/applyHitClaim, :764-807 handlePlayerLeft, :845-865 computeResult/syncHud, :976-987 localInputFrame), `src/game/Player.ts` (поле team), `src/game/controllers/BotController.ts` (:44-60 конструктор), `src/hooks/useGameHUD.ts` (:8-11 PlayerScore/MatchResult)
- Test: `tests/unit/Match.test.ts`, Create `tests/unit/Match.teams.test.ts`

**Interfaces:**
- Consumes: `GameMode/teamOfSlot` (T1), `spawnPositionsFor` (T2).
- Produces:
  - `Player.team: number` (назначается в buildPlayers)
  - `MatchOptions { …; mode?: GameMode; ffaSpawns?: Vec3[] }` (default '1v1' — старые тесты живут)
  - `PlayerScore { id: number; name: string; kills: number; deaths: number; team: number; left?: boolean }`
  - `MatchResult { outcome; reason: 'time' | 'disconnect'; scores: PlayerScore[]; ranking: TeamRank[] }`, `TeamRank { team: number; kills: number; memberIds: number[] }`
  - `BotController` конструктор: `getTarget: () => Player | null` вместо `getOpponent`

- [ ] **Step 1: Падающие тесты** — `tests/unit/Match.teams.test.ts` (харнес копирует makeMatch из Match.test.ts, но с mode/ростером на 3-4):

```ts
// Ключевые кейсы (полный код теста — по образцу makeMatch/step/aimHumanAtBot из Match.test.ts):
// 1. mode '2v2', roster 4 (я+бот команда 0, 2 бота команда 1): выстрел в тиммейта — луч гаснет:
//    resolveHit не даёт ни kill, ни block (deaths тиммейта 0, мои kills 0), событие fired есть.
// 2. mode '2v2': спавны — игроки 0,1 около MAPS[map].spawns[0], игроки 2,3 около spawns[1] (dist < 3).
// 3. mode 'ffa' + ffaSpawns [[..],[..],[..]]: каждый на своей позиции.
// 4. computeResult ranking: подделать kills (p.kills = …) → команды отсортированы по сумме;
//    моя команда первая → outcome 'win'; делит первое → 'draw'.
// 5. handlePlayerLeft(id бота-владельца-нет — на звезде это клиент): при mode 'ffa' на 3+
//    матч НЕ завершается, счёт помечен left; при остатке одной команды — endMatch.
// 6. BotController: цель — ближайший живой не-тиммейт (2v2: бот команды 0 целится в ближайшего из команды 1).
// 7. Дефолт mode '1v1' на старом ростере: спавны/поведение прежние (регрессия-гард).
```
Написать их конкретным кодом по образцам существующих тестов (aimHumanAtBot, step, forceLiveForTest).

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализация:**

3.1 `Player.ts`: `team = 0` (публичное поле, назначается извне).

3.2 `MatchOptions` += `mode?: GameMode`, `ffaSpawns?: Vec3[]`. В конструкторе: `this.mode = o.mode ?? '1v1'`.

3.3 `buildPlayers`:
- `p.team = teamOfSlot(this.mode, e.id)` после создания.
- Спавн: заменить строку 242 на
```ts
const spawnMap = spawnPositionsFor(this.mode, roster.map(r => r.id), spawns, o.ffaSpawns)
…
p.respawnAt(new THREE.Vector3().fromArray(spawnMap.get(e.id)!))
```
- `opponentIsBot`/`bots`: `bots = players.filter(p => p.id !== localId && roster-entry.kind === 'bot')` (переписать выборку с `e.id === OPPONENT_ID` на kind).
- BotController: `new BotController(p, () => this.nearestEnemy(p), …)`; добавить метод:
```ts
/** Nearest ALIVE enemy of `p` (teammates and the dead are skipped); null when nobody hostile is up. */
private nearestEnemy(p: Player): Player | null {
  let best: Player | null = null; let bestD = Infinity
  for (const o of this.players) {
    if (o === p || o.team === p.team || !o.alive || this.leftIds.has(o.id)) continue
    const d = o.position.distanceTo(p.position)
    if (d < bestD) { bestD = d; best = o }
  }
  return best
}
```
`BotController`: поле/параметр `getTarget: () => Player | null`; внутри update: `const target = this.getTarget(); if (!target) { …WANDER-ветка…; return }` — все обращения `this.getOpponent()` заменить на `target` c null-гардом (прочитать файл целиком при исполнении; passive-ветка не трогается).

3.4 Дружественный огонь: в `resolveHit` первой строкой
```ts
if (shooter !== victim && shooter.team === victim.team) return   // teammate bodies block the beam but take no harm
```
и в `applyHitClaim` аналогичный дроп с `gameLog.warn('act','claim_drop',{reason:'teammate'})`.

3.5 `handlePlayerLeft(id)`: пометить `leftIds`, скрыть визуалы (существующий код), `scoresDirty = true`; вместо безусловного `endMatch('disconnect')`:
```ts
const teamsAlive = new Set(this.players.filter(p => !this.leftIds.has(p.id)).map(p => p.team))
if (teamsAlive.size < 2) this.endMatch('disconnect')
```
На клиенте уход хоста (id 0) по-прежнему завершает матч этим же правилом ТОЛЬКО если хост был единственным врагом; но на звезде без хоста матч мёртв всегда → в `NetSession.onPeerLeave` клиентская ветка уже зовёт `handlePlayerLeft(0)`; добавить в Match: `if (this.role === 'client' && id === 0) return this.endMatch('disconnect')` ПЕРЕД общим правилом (комментарий: star topology — no host, no match; mesh branch will remove this).

3.6 Счёт и исход:
- `syncHud`/`computeResult`: `scores = players.map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, team: p.team, left: this.leftIds.has(p.id) || undefined }))`.
- `computeResult`:
```ts
const byTeam = new Map<number, { kills: number; memberIds: number[] }>()
for (const p of this.players) { const t = byTeam.get(p.team) ?? { kills: 0, memberIds: [] }; t.kills += p.kills; t.memberIds.push(p.id); byTeam.set(p.team, t) }
const ranking = [...byTeam.entries()].map(([team, v]) => ({ team, ...v })).sort((a, b) => b.kills - a.kills)
const myTeam = this.byId.get(this.localId)?.team ?? 0
let outcome: MatchOutcome
if (reason === 'disconnect') {
  const remains = this.players.some(p => p.team === myTeam && !this.leftIds.has(p.id))
  outcome = remains ? 'win' : 'lose'
} else {
  const top = ranking[0].kills
  const topTeams = ranking.filter(r => r.kills === top)
  outcome = topTeams.some(r => r.team === myTeam) ? (topTeams.length > 1 ? 'draw' : 'win') : 'lose'
}
return { outcome, reason, scores, ranking }
```
- `useGameHUD.ts`: обновить `PlayerScore`/`MatchResult` типы (+ `TeamRank`).

3.7 `localInputFrame` (клиент, :984): заменить `find`-одного на максимум по ремоутам:
```ts
let viewTick = 0
for (const p of this.players) if (p.id !== this.localId) viewTick = Math.max(viewTick, p.renderHostTick())
if (viewTick > 0) frame.viewTick = viewTick
```
3.8 Комментарий `excludeIds` (:273-274) обновить: `// Raycast excludes only the shooter: teammates DO block the beam (tactics); harm is gated in resolveHit.`

- [ ] **Step 4: Прогнать** `Match.test.ts`, `Match.teams.test.ts`, `MatchNet.test.ts`, `Match.matchEnd.test.ts`, `Match.streak.test.ts`, `BotController.test.ts`, `useGameHUD.streak.test.ts` → PASS (старые правятся только там, где смысл не менялся — например, конструктор BotController в тестах).
- [ ] **Step 5: Commit** — `feat(match): команды из пресета режима — friendly-block, N-исход с ранжированием, спавны, цель бота, уход без конца матча`

---

### Task 6: Плашки над игроками

**Files:**
- Create: `src/game/fx/nameplate.ts`
- Modify: `src/game/Player.ts` (setNameplate + видимость в update), `src/game/Match.ts` (buildPlayers — навесить по режиму), `src/constants.ts` (высота/размер плашки)
- Test: Create `tests/unit/nameplate.test.ts`

**Interfaces:**
- Produces: `createNameplate(name: string, bg: string): THREE.Sprite` (canvas-текстура, `userData.noRaycast = true`); `Player.setNameplate(s: THREE.Sprite | null)`.

- [ ] **Step 1: Падающий тест** — `tests/unit/nameplate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createNameplate } from '../../src/game/fx/nameplate'
import { NAMEPLATE_HEIGHT } from '../../src/constants'

describe('nameplate', () => {
  it('sprite: noRaycast, positioned above the head, texture present', () => {
    const s = createNameplate('Sanya', '#37f')
    expect(s.userData.noRaycast).toBe(true)
    expect(s.position.y).toBe(NAMEPLATE_HEIGHT)
    expect(s.material.map).toBeTruthy()
  })
})
// + в Match.teams.test.ts: mode '2v2' → у ремоутов в bodyGroup есть Sprite, у своего — нет;
//   mode '1v1' → ни у кого; после receiveHit (смерть) sprite.visible === false.
```

- [ ] **Step 2: FAIL** → **Step 3: Реализация:**

`src/constants.ts`: `export const NAMEPLATE_HEIGHT = 1.35` (над центром шара), `export const NAMEPLATE_SCALE: [number, number] = [1.6, 0.4]`, локально в nameplate.ts — размеры канвы/шрифта.

`src/game/fx/nameplate.ts`: canvas 256×64, скруглённый прямоугольник цвета `bg`, имя тёмным жирным по центру (обрезать до ~12 симв. с «…»), `THREE.CanvasTexture`, `SpriteMaterial { map, depthWrite: false }`, `sprite.scale.set(...NAMEPLATE_SCALE, 1)`, `sprite.position.y = NAMEPLATE_HEIGHT`, `sprite.userData.noRaycast = true`. (jsdom: `HTMLCanvasElement.getContext` может вернуть null — в тесте это допустимо, если код гардит `if (ctx)`; текстура создаётся всё равно.)

`Player.ts`: поле `private nameplate: THREE.Sprite | null = null`; `setNameplate(s)`: снять старую из bodyGroup, добавить новую; в `update()` (или там, где обновляется видимость тела): `if (this.nameplate) this.nameplate.visible = this.alive`.

`Match.buildPlayers`: после создания игрока:
```ts
if (this.mode !== '1v1' && e.id !== net.localId) {
  const bg = this.mode === '2v2' ? TEAM_COLORS[teamOfSlot(this.mode, e.id)] : NAMEPLATE_NEUTRAL_COLOR
  p.setNameplate(createNameplate(e.name, bg))
}
```

- [ ] **Step 4: PASS** (nameplate.test + дополненные Match.teams) → **Step 5: Commit** — `feat(hud3d): плашки имён — цвет команды в 2v2, нейтральные в FFA, нет в 1v1`

---

### Task 7: HUD-слой — счёт по id, ReadyOverlay-список, экран конца с таблицей

Функциональная адаптация; красота — потом (frontend-design).

**Files:**
- Modify: `src/components/MatchHud.tsx` (:29-31 и разметка), `src/components/ReadyOverlay.tsx` (:32-44), `src/components/MatchEndedOverlay.tsx`, `src/game/Match.ts` (клиентская ветка scores — событие уже несёт новый формат), `src/i18n/dict.ts` + 10 локалей (строки таблицы: `hudTeam`, `matchPlace(n)` или аналог)
- Test: существующие юниты компонентов, если есть (grep `MatchHud` в tests/unit); e2e `scoreboard.spec.ts` — адаптировать

**Interfaces:**
- Consumes: `PlayerScore { id, name, kills, deaths, team, left? }`, `MatchResult.ranking` (Task 5).

- [ ] **Step 1: Правки (для UI — сначала код, потом прогон существующих тестов):**
  - `MatchHud`: счёт искать по id (`scores.find(s => s.id === entry.id)`); при `roster.length === 2` — текущая двусторонняя разметка (пиксель-в-пиксель); при `> 2` — компактный вертикальный список в левом верхнем углу: `имя — kills` построчно, отсортировано, моя строка подсвечена, `left` — приглушённая с пометкой `✕`. Streak-dots в списковом виде не рисуем (v1).
  - `ReadyOverlay`: вместо двух углов — центрированный столбец строк `{имя (цвет игрока)} — READY/NOT READY` для всего ростера (моё имя подчёркнуто, как сейчас); клик-хендлер и `ready-button` не меняются. Для `roster.length === 2` сохранить текущие два угла (ветка по длине) — 1v1 нетронут.
  - `MatchEndedOverlay`: под заголовком исхода — таблица из `result.ranking`: строка на команду (в 1v1/FFA это игрок): `место. имена — суммарные kills`; данные имён брать из `result.scores` по `memberIds`.
- [ ] **Step 2: Прогнать юниты всего каталога компонентов + `npx tsc -b --noEmit`.**
- [ ] **Step 3: Commit** — `feat(hud): счёт по id, список ready, таблица мест на экране конца`

---

### Task 8: Лобби-UI и проводка App

**Files:**
- Modify: `src/components/lobby/types.ts`, `src/screens/Lobby.tsx`, `src/components/lobby/LobbySeats.tsx`, `src/components/lobby/LobbyAction.tsx`, Create `src/components/lobby/ModePicker.tsx`
- Modify: `src/App.tsx` (:109-119 GameNet, :483-509 bindSession/onStart, :546-562 enterTabIdle, :883 onLobbySetTab, :981-1015 buildLobby, :619 hasOpponent), `src/Game.tsx` (прокинуть mode/ffaSpawns в MatchOptions), `src/components/MenuBackdrop.tsx` (:494-509 computeBalls — «первый занятый не-я слот» вместо OPPONENT_ID), `src/components/menuStage.ts` при необходимости, `src/constants.ts` (удалить `OPPONENT_ID`, если grep чист)
- Modify: `src/i18n/dict.ts` + все 10 локалей: `lobbyMode1v1: '1 VS 1'`, `lobbyMode2v2: '2 VS 2'`, `lobbyModeFfa: 'FREE FOR ALL'` (в ru: «КАЖДЫЙ САМ ЗА СЕБЯ»; остальные локали — перевести по смыслу)

**Interfaces:**
- Consumes: `RoomView { slots, mode, canStart }`, `requestSlot/setMode/addBot(slot)/removeBot(slot)` (Task 4).
- Produces (для e2e Task 9): testid `lobby-mode-1v1|2v2|ffa`, `lobby-seat-0..3` (свой слот дополнительно `lobby-me`; занятый ботом — с внутренним `lobby-bot-name`), поведение кликов ниже.

- [ ] **Step 1: types.ts:**
```ts
export interface SeatView {
  slot: number
  entry: { name: string; color: string; ready: boolean; isBot: boolean } | null
  mine: boolean
  team: number   // teamOfSlot(mode, slot); в 1v1/ffa не подсвечивается
}
```
`LobbyProps`: заменить `me: LobbySlot; opponent: OppSlot | null` на `seats: SeatView[]; mode: GameMode; onSetMode: (m: GameMode) => void; onSeatClick: (slot: number) => void`; `LobbySlot/OppSlot` удалить после зачистки потребителей.

- [ ] **Step 2: ModePicker** — сегмент-контрол по образцу `BotDifficultyPicker` (тот же CSS-класс `seg`), testid `lobby-mode-${m}`, disabled для не-хоста и при `searching`.

- [ ] **Step 3: LobbySeats:** рендер по режиму:
  - `1v1` (2 сиденья): ТОЧНО текущая разметка `seat VS seat` — включая `lobby-me`/`lobby-opponent` testid (обратная совместимость e2e) + новые `lobby-seat-i`.
  - `2v2`: `[seat0 seat1] VS [seat2 seat3]`, группы обёрнуты в контейнер с рамкой цвета `TEAM_COLORS[i]`.
  - `ffa`: ряд из 4 сидений без VS.
  - Пустое сиденье: глиф `—`; для ХОСТА — курсор pointer и title «добавить бота»; клик → `onSeatClick(slot)`. Занятый ботом (host): существующий botSeat (имя-инпут + reroll) + клик по крестику/правый клик НЕ вводить — удаление бота: маленькая `✕`-кнопка в углу сиденья (testid `lobby-bot-remove-${slot}`).
  - Клиент: клик по ПУСТОМУ сиденью → `onSeatClick(slot)` (пересадка).

- [ ] **Step 4: App:**
  - `buildLobby`: собрать `seats` из `v.slots` (`mine: r?.id === v.localPlayerId`), `mode: v.mode`; хендлеры: `onSetMode: s => session.setMode(s)`; `onSeatClick(slot)`: host → `slots[slot]` пуст ? `addBot(botDifficulty, undefined, slot)` : (бот ? `removeBot(slot)` : no-op); client → пуст ? `requestSlot(slot)` : no-op. Удалить `myId/oppId`-вычисления (:990-998).
  - `GameNet` += `mode: GameMode; ffaSpawns?: Vec3[]`; `onStart` коллбек RoomSession теперь `(durationMs, mapId, mode, spawns)` — прокинуть.
  - `Game.tsx`: `GameProps` += `mode`, `ffaSpawns`; в `new Match({...})` — `mode: gameMode, ffaSpawns`.
  - `enterTabIdle` bot-вкладка: без изменений (`addBot()` сядет в слот 1 при дефолтном 1v1).
  - `hasOpponent` (:619) и `MenuBackdrop.computeBalls` (:494-509): заменить `find(r => r.id === OPPONENT_ID)` на «первый занятый слот с id !== localPlayerId» (бэкдроп продолжает показывать максимум 2 шара — стейдж на 2 места; полный N-стейдж — frontend-design позже, отметить комментарием).
  - `grep -rn "OPPONENT_ID" src/` → если остались только тесты — удалить константу из `constants.ts` и починить импорты тестов на литерал `1`.

- [ ] **Step 5: Прогон** — `npx tsc -b --noEmit && npm run lint`, юниты `RoomSession/Match/protocol` повторно.
- [ ] **Step 6: Commit** — `feat(lobby): режим-пикер, 4 сиденья с командами, пересадка, боты по слотам`

---

### Task 9: E2e + финальный чекпоинт

**Files:**
- Modify: `tests/room.spec.ts`, `tests/lobby-tabs.spec.ts` (новые testid при необходимости; 1v1-кейсы должны пройти БЕЗ правок — совместимость testid из Task 8)
- Create: `tests/lobby-modes.spec.ts`
- Modify: `tests/scoreboard.spec.ts` (формат PlayerScore)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Новый e2e `lobby-modes.spec.ts`** (headless, BroadcastChannelNet):
  - хост: PLAY → WITH BOT → `lobby-mode-ffa` → сиденья `lobby-seat-2/3` видимы; клик по `lobby-seat-2` → бот появился; READY → матч стартует (`__debugPhase` → live через `__debugForceLive`); `__debugBotPos` существует.
  - 2v2: хост + 3 бота (клики по пустым сиденьям) → READY → live; убедиться `lobby-mode-2v2` даёт группы (проверка класса контейнера).
  - двухвкладочный: хост ffa + клиент заходит по коду → у клиента `lobby-seat-*` с его именем; клиент кликает свободный слот → пересел (текст сиденья сменил позицию). БЕЗ боевых ассертов (флак).
- [ ] **Step 2: Прогнать только новые/затронутые e2e:** `npx playwright test --project=headless tests/lobby-modes.spec.ts tests/room.spec.ts tests/lobby-tabs.spec.ts`.
- [ ] **Step 3: Все юниты** `npm run test:unit` → PASS.
- [ ] **Step 4: ЧЕКПОИНТ — доклад пользователю** (диффстат, что играбельно: 1v1 как раньше; FFA/2v2 против ботов полностью; человек-клиент в FFA/2v2 на звезде — вход/пересадка/матч). Полный `npm run test` — только после подтверждения.
- [ ] **Step 5: После подтверждения:** `npm run test` (флаки двухвкладочных боевых — перегнать одиночно), CHANGELOG (Added: режимы 2v2 и FFA до 4 игроков, лобби со слотами, плашки имён), предложить мерж в `release_1.1.0`.

```bash
git add CHANGELOG.md && git commit -m "docs: changelog — режимы 2v2/FFA, лобби на 4 слота"
```

---

## Заметки исполнителю

- **LoopbackNet на N пиров**: проверить `src/net/LoopbackNet.ts` ДО Task 4; если только пары — добавить `createLoopbackHub(ids)` (все слышат всех, синхронная доставка) с юнитом в `LoopbackNet.test.ts`. Если правка нетривиальна — мультиклиентские юниты заменить на host+1client+боты, мультиклиент оставить e2e.
- **BotController**: перед правкой прочитать файл целиком (259 строк) — все `getOpponent()`-вызовы к `getTarget()` с null-гардом; WANDER-поведение при отсутствии цели уже есть (waypoint), использовать его.
- **Совместимость сейвов/веба**: старый клиент, не знающий `mode`, в комнату нового хоста не заходит только при несовпадении версий протокола — версии нет; Assign с лишним полем старый клиент игнорирует (JSON) и играет 1v1-полем `yourId`. Не проектируем совместимость специально (веб-релиз остаётся 1v1), но и не ломаем 2-слотовый дефолт.
- Отложенные правки из `2026-07-07-colors-rework.md` Step 6 (ballArt лобби-задника, Appearance превью/подпись) — сюда НЕ тащить.
