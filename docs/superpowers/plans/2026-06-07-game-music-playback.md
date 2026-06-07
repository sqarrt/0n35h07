# Музыка в матче: воспроизведение слоёных стемов — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Проигрывать в матче эволюционирующую фоновую музыку, собранную из готовых Opus-стемов (`render_opus/`): интро `kicks+bass`, позже вступают `lead`/`sfx`; детерминированно от лобби-кода, одинаково у обоих игроков.

**Architecture:** Новый слой `src/game/audio/`. Чистая композиционная логика (`MusicDirector`, `rng`) отделена от браузерного движка (`WebAudioMusicEngine`) интерфейсом `IMusicEngine` (DIP). `MatchMusic` связывает сид+директора с движком и владеет жизненным циклом. `Match` заводит музыку на переходе в `live`, останавливает на `dispose`. Семпл-точное зацикливание — lookahead-планировщик на сетке `LOOP_SECONDS=8.0` (не по длине файла — там Opus-паддинг).

**Tech Stack:** TypeScript 6 (`erasableSyntaxOnly` — БЕЗ parameter properties/enum/namespace), Web Audio API, Vite 8 (`import.meta.glob` для манифеста ассетов), vitest (юнит), Playwright (e2e).

**Спека:** `docs/superpowers/specs/2026-06-07-game-music-playback-design.md`

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/assets/music/<role>/*.opus` | Ассеты (переезд из `render_opus/`) |
| `src/game/audio/types.ts` | Общие типы: `Role`, `StemRef`, `StemLibrary`, `VoiceSpec`, `Arrangement`, `IMusicEngine` |
| `src/game/audio/rng.ts` | Детерминированный PRNG: `hashSeed`, `mulberry32` |
| `src/game/audio/stems.ts` | Манифест библиотеки через `import.meta.glob` (роль = папка) |
| `src/game/audio/MusicDirector.ts` | **Единственное место правил**: `compose(seed, loopIndex, library)` |
| `src/game/audio/WebAudioMusicEngine.ts` | Браузерный движок: декод, lookahead-планировщик, кроссфейды |
| `src/game/audio/MatchMusic.ts` | Связка сид+директор+движок, жизненный цикл, `__debugMusic` |
| `src/game/Match.ts` | (правка) создаёт `MatchMusic`, старт на `live`, стоп на `dispose` |
| `src/Game.tsx` | (правка) создаёт `WebAudioMusicEngine`, прокидывает `seedCode` |
| `src/App.tsx` | (правка) добавляет `code` в `GameNet`, передаёт в `Game` |
| `src/debug-globals.d.ts` | (правка) тип `__debugMusic` |
| `tests/unit/rng.test.ts` | Юнит: детерминизм PRNG |
| `tests/unit/MusicDirector.test.ts` | Юнит: композиция (детерминизм, интро, вступление) |
| `tests/unit/MatchMusic.test.ts` | Юнит: связка с фейк-движком |
| `tests/music.spec.ts` | e2e: дымовой (AudioContext поднялся, источники запланированы) |

---

## Task 1: Переезд ассетов + игнор prebake.strudel

**Files:**
- Move: `render_opus/<role>/*.opus` → `src/assets/music/<role>/*.opus`
- Modify: `.gitignore`

- [ ] **Step 1: Перенести стемы в src/assets/music**

```bash
mkdir -p src/assets/music
mv render_opus/bass src/assets/music/bass
mv render_opus/kicks src/assets/music/kicks
mv render_opus/lead src/assets/music/lead
mv render_opus/sfx src/assets/music/sfx
rmdir render_opus
```

- [ ] **Step 2: Проверить структуру**

Run: `ls src/assets/music && ls src/assets/music/bass | head -3`
Expected: четыре папки `bass kicks lead sfx`; внутри `bass` — `.opus`-файлы (`decent_bass.opus` и т.д.)

- [ ] **Step 3: Добавить prebake.strudel в .gitignore**

Добавить строку в конец `.gitignore`:

```
# Strudel-прелюдия редактора музыки (AGPL-сосед) — в игру не тащим
prebake.strudel
```

- [ ] **Step 4: Закоммитить ассеты**

```bash
git add src/assets/music .gitignore
git commit -m "feat(audio): рендер-стемы в src/assets/music + игнор prebake.strudel"
```

---

## Task 2: Типы + детерминированный PRNG

**Files:**
- Create: `src/game/audio/types.ts`
- Create: `src/game/audio/rng.ts`
- Test: `tests/unit/rng.test.ts`

- [ ] **Step 1: Создать types.ts**

```ts
// src/game/audio/types.ts
export type Role = 'bass' | 'kicks' | 'lead' | 'sfx'
export const ROLES: readonly Role[] = ['bass', 'kicks', 'lead', 'sfx']

/** Один стем: стабильный id (`role/name`) + URL ассета. */
export interface StemRef { id: string; url: string }
export type StemLibrary = Record<Role, StemRef[]>

/** Один звучащий голос на текущем лупе. */
export interface VoiceSpec { role: Role; stemId: string; gain: number }
/** Набор голосов на луп — результат композиции. */
export type Arrangement = VoiceSpec[]

/** Движок воспроизведения (DIP-граница: реальный Web Audio ИЛИ фейк в тестах). */
export interface IMusicEngine {
  load(library: StemLibrary): Promise<void>
  /** Запускает планировщик; provider даёт аранжировку для каждого loopIndex. */
  start(provider: (loopIndex: number) => Arrangement): Promise<void>
  stop(): void
  setMasterGain(gain: number): void
  dispose(): void
  /** Индекс последнего запланированного лупа (для дебага/e2e). */
  readonly loopIndex: number
  /** Активные stemId на текущем лупе (для дебага/e2e). */
  activeStemIds(): string[]
}
```

- [ ] **Step 2: Написать падающий тест rng**

```ts
// tests/unit/rng.test.ts
import { describe, it, expect } from 'vitest'
import { hashSeed, mulberry32 } from '../../src/game/audio/rng'

describe('hashSeed', () => {
  it('детерминирован: одна строка → один сид', () => {
    expect(hashSeed('AB12')).toBe(hashSeed('AB12'))
  })
  it('разные строки → разные сиды (как правило)', () => {
    expect(hashSeed('AB12')).not.toBe(hashSeed('AB13'))
  })
  it('возвращает uint32', () => {
    const h = hashSeed('XYZ9')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xFFFFFFFF)
  })
})

describe('mulberry32', () => {
  it('детерминирован: один сид → одинаковая последовательность', () => {
    const a = mulberry32(123), b = mulberry32(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('значения в [0,1)', () => {
    const r = mulberry32(999)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/rng.test.ts`
Expected: FAIL — модуль `rng` не найден / экспортов нет.

- [ ] **Step 4: Реализовать rng.ts**

```ts
// src/game/audio/rng.ts
// Детерминированный PRNG для музыки: стабильный хеш строки → mulberry32.

/** FNV-1a 32-бит: строка (лобби-код) → uint32-сид. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32: сид → генератор чисел в [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npx vitest run --config vitest.config.ts tests/unit/rng.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 6: Коммит**

```bash
git add src/game/audio/types.ts src/game/audio/rng.ts tests/unit/rng.test.ts
git commit -m "feat(audio): типы аудио-слоя + детерминированный PRNG"
```

---

## Task 3: Манифест библиотеки стемов

**Files:**
- Create: `src/game/audio/stems.ts`
- Test: `tests/unit/stems.test.ts`

- [ ] **Step 1: Написать падающий тест stems**

```ts
// tests/unit/stems.test.ts
import { describe, it, expect } from 'vitest'
import { STEM_LIBRARY } from '../../src/game/audio/stems'
import { ROLES } from '../../src/game/audio/types'

describe('STEM_LIBRARY', () => {
  it('содержит все 4 роли непустыми', () => {
    for (const role of ROLES) {
      expect(STEM_LIBRARY[role].length).toBeGreaterThan(0)
    }
  })
  it('id стемов в формате role/name и уникальны', () => {
    const ids = ROLES.flatMap(r => STEM_LIBRARY[r].map(s => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(STEM_LIBRARY.bass.every(s => s.id.startsWith('bass/'))).toBe(true)
  })
  it('у каждого стема есть url', () => {
    expect(STEM_LIBRARY.kicks.every(s => typeof s.url === 'string' && s.url.length > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/stems.test.ts`
Expected: FAIL — модуль `stems` не найден.

- [ ] **Step 3: Реализовать stems.ts**

```ts
// src/game/audio/stems.ts
import type { Role, StemLibrary } from './types'
import { ROLES } from './types'

// Vite: собираем все рендер-стемы как URL. Роль = имя папки (см. музыкальную память проекта).
const modules = import.meta.glob('../../assets/music/*/*.opus', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>

function buildLibrary(): StemLibrary {
  const lib: StemLibrary = { bass: [], kicks: [], lead: [], sfx: [] }
  for (const [path, url] of Object.entries(modules)) {
    const m = path.match(/\/music\/([^/]+)\/([^/]+)\.opus$/)
    if (!m) continue
    const role = m[1] as Role
    if (!ROLES.includes(role)) continue
    lib[role].push({ id: `${role}/${m[2]}`, url })
  }
  // Стабильный порядок по id → одинаковые индексы выбора у обоих пиров и между сборками.
  for (const role of ROLES) lib[role].sort((a, b) => a.id.localeCompare(b.id))
  return lib
}

export const STEM_LIBRARY: StemLibrary = buildLibrary()
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run --config vitest.config.ts tests/unit/stems.test.ts`
Expected: PASS (3 теста). Если падает на «непустые роли» — проверь, что Task 1 (переезд ассетов) выполнен.

- [ ] **Step 5: Коммит**

```bash
git add src/game/audio/stems.ts tests/unit/stems.test.ts
git commit -m "feat(audio): манифест библиотеки стемов через import.meta.glob"
```

---

## Task 4: MusicDirector — правила композиции

**Files:**
- Create: `src/game/audio/MusicDirector.ts`
- Test: `tests/unit/MusicDirector.test.ts`

- [ ] **Step 1: Написать падающий тест MusicDirector**

```ts
// tests/unit/MusicDirector.test.ts
import { describe, it, expect } from 'vitest'
import { MusicDirector } from '../../src/game/audio/MusicDirector'
import type { StemLibrary } from '../../src/game/audio/types'

// Синтетическая библиотека — тесты не зависят от реальных ассетов.
const LIB: StemLibrary = {
  bass:  [{ id: 'bass/b1', url: 'b1' }, { id: 'bass/b2', url: 'b2' }],
  kicks: [{ id: 'kicks/k1', url: 'k1' }, { id: 'kicks/k2', url: 'k2' }],
  lead:  [{ id: 'lead/l1', url: 'l1' }, { id: 'lead/l2', url: 'l2' }],
  sfx:   [{ id: 'sfx/s1', url: 's1' }, { id: 'sfx/s2', url: 's2' }],
}
const rolesOf = (arr: { role: string }[]) => arr.map(v => v.role).sort()

describe('MusicDirector.compose', () => {
  const d = new MusicDirector()

  it('детерминирован: (seed, loopIndex) → одинаковая аранжировка', () => {
    expect(d.compose(42, 5, LIB)).toEqual(d.compose(42, 5, LIB))
  })

  it('интро (loopIndex 0,1): только kicks+bass', () => {
    expect(rolesOf(d.compose(42, 0, LIB))).toEqual(['bass', 'kicks'])
    expect(rolesOf(d.compose(42, 1, LIB))).toEqual(['bass', 'kicks'])
  })

  it('после интро (loopIndex 2): вступают lead и sfx', () => {
    expect(rolesOf(d.compose(42, 2, LIB))).toEqual(['bass', 'kicks', 'lead', 'sfx'])
  })

  it('все stemId существуют в библиотеке', () => {
    const all = new Set(Object.values(LIB).flat().map(s => s.id))
    for (const v of d.compose(7, 9, LIB)) expect(all.has(v.stemId)).toBe(true)
  })

  it('у каждого голоса положительный gain', () => {
    for (const v of d.compose(7, 2, LIB)) expect(v.gain).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts`
Expected: FAIL — модуль `MusicDirector` не найден.

- [ ] **Step 3: Реализовать MusicDirector.ts**

```ts
// src/game/audio/MusicDirector.ts
import type { Role, StemLibrary, Arrangement, VoiceSpec } from './types'
import { mulberry32 } from './rng'

// --- ПРАВИЛА КОМПОЗИЦИИ (тюнятся здесь — константами ИЛИ переписыванием алгоритма) ---
const INTRO_LOOPS = 2        // столько 8с-лупов играют только kicks+bass до вступления остального
const SWAP_EVERY_LOOPS = 4   // как часто можно сменить выбранный стем внутри роли
const ROLE_GAIN: Record<Role, number> = { bass: 0.9, kicks: 1.0, lead: 0.7, sfx: 0.5 }
const ROLE_SALT: Record<Role, number> = { bass: 0x1111, kicks: 0x2222, lead: 0x3333, sfx: 0x4444 }
const CYCLE_MIX = 0x9E3779B1   // золотое сечение — перемешивает номер цикла подмены

const INTRO_ROLES: Role[] = ['kicks', 'bass']
const FULL_ROLES: Role[] = ['kicks', 'bass', 'lead', 'sfx']

function pickVoice(role: Role, seed: number, cycle: number, library: StemLibrary): VoiceSpec | null {
  const stems = library[role]
  if (stems.length === 0) return null
  const rng = mulberry32((seed ^ ROLE_SALT[role] ^ Math.imul(cycle + 1, CYCLE_MIX)) >>> 0)
  const idx = Math.floor(rng() * stems.length)
  return { role, stemId: stems[idx].id, gain: ROLE_GAIN[role] }
}

/** Чистая детерминированная композиция. Единственное место музыкальных правил. */
export class MusicDirector {
  compose(seed: number, loopIndex: number, library: StemLibrary): Arrangement {
    const cycle = Math.floor(loopIndex / SWAP_EVERY_LOOPS)
    const roles = loopIndex < INTRO_LOOPS ? INTRO_ROLES : FULL_ROLES
    const voices: VoiceSpec[] = []
    for (const role of roles) {
      const v = pickVoice(role, seed, cycle, library)
      if (v) voices.push(v)
    }
    return voices
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Коммит**

```bash
git add src/game/audio/MusicDirector.ts tests/unit/MusicDirector.test.ts
git commit -m "feat(audio): MusicDirector — детерминированная композиция (интро kicks+bass)"
```

---

## Task 5: WebAudioMusicEngine — браузерный движок

**Files:**
- Create: `src/game/audio/WebAudioMusicEngine.ts`

Покрытие — e2e (Task 9): Web Audio/`AudioContext`/`decodeAudioData` не работают в jsdom, юнит-теста у движка нет.

- [ ] **Step 1: Реализовать WebAudioMusicEngine.ts**

```ts
// src/game/audio/WebAudioMusicEngine.ts
import type { StemLibrary, Arrangement, IMusicEngine } from './types'

const LOOP_SECONDS = 8.0          // музыкальная длина лупа (НЕ длина файла 8.0065 — там Opus-паддинг)
const SCHEDULE_AHEAD_SEC = 0.25   // насколько вперёд планируем источники
const SCHEDULER_TICK_MS = 50      // период тика планировщика
const START_DELAY_SEC = 0.12      // отступ первого лупа от currentTime (на декод/планирование)
const FADE_SEC = 0.04             // фейд-ин впервые вступающего голоса (анти-щелчок)
const MASTER_GAIN_DEFAULT = 0.6

/** Web Audio движок: декод стемов, lookahead-планировщик, семпл-точное зацикливание + кроссфейд. */
export class WebAudioMusicEngine implements IMusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private provider: ((loopIndex: number) => Arrangement) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBoundary = 0
  private _loopIndex = 0
  private prevIds = new Set<string>()
  private _active = new Set<string>()

  get loopIndex(): number { return Math.max(0, this._loopIndex - 1) }
  activeStemIds(): string[] { return [...this._active] }

  async load(library: StemLibrary): Promise<void> {
    const ctx = this.ensureCtx()
    const refs = Object.values(library).flat()
    await Promise.all(refs.map(async ref => {
      if (this.buffers.has(ref.id)) return
      const data = await (await fetch(ref.url)).arrayBuffer()
      this.buffers.set(ref.id, await ctx.decodeAudioData(data))
    }))
  }

  async start(provider: (loopIndex: number) => Arrangement): Promise<void> {
    const ctx = this.ensureCtx()
    this.provider = provider
    if (ctx.state === 'suspended') await ctx.resume()
    this._loopIndex = 0
    this.prevIds.clear()
    this.nextBoundary = ctx.currentTime + START_DELAY_SEC
    if (this.timer == null) this.timer = setInterval(() => this.tick(), SCHEDULER_TICK_MS)
    this.tick()
  }

  stop(): void {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
    this._active.clear()
    this.prevIds.clear()
  }

  setMasterGain(gain: number): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05)
  }

  dispose(): void {
    this.stop()
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
    this.buffers.clear()
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = MASTER_GAIN_DEFAULT
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private tick(): void {
    const ctx = this.ctx
    const provider = this.provider
    if (!ctx || !provider || !this.master) return
    while (this.nextBoundary < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleLoop(this._loopIndex, this.nextBoundary, provider)
      this.nextBoundary += LOOP_SECONDS
      this._loopIndex++
    }
  }

  private scheduleLoop(loopIndex: number, when: number, provider: (i: number) => Arrangement): void {
    const ctx = this.ctx!
    const master = this.master!
    const arr = provider(loopIndex)
    const ids = new Set(arr.map(v => v.stemId))
    for (const v of arr) {
      const buf = this.buffers.get(v.stemId)
      if (!buf) continue
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      if (this.prevIds.has(v.stemId)) {
        g.gain.setValueAtTime(v.gain, when)               // продолжающийся голос — стык встык, без фейда
      } else {
        g.gain.setValueAtTime(0, when)                    // впервые вступает — короткий фейд-ин
        g.gain.linearRampToValueAtTime(v.gain, when + FADE_SEC)
      }
      src.connect(g).connect(master)
      src.start(when)
      src.stop(when + LOOP_SECONDS)   // обрезаем хвост-паддинг файла → ровно 8.0с, без наложения с след. лупом
    }
    this.prevIds = ids
    this._active = ids
  }
}
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc -b --noEmit`
Expected: без ошибок (в т.ч. соблюдён `erasableSyntaxOnly` — поля объявлены явно, без parameter properties).

- [ ] **Step 3: Коммит**

```bash
git add src/game/audio/WebAudioMusicEngine.ts
git commit -m "feat(audio): WebAudioMusicEngine — lookahead-планировщик на сетке 8.0с"
```

---

## Task 6: MatchMusic — связка + дебаг-глобал

**Files:**
- Create: `src/game/audio/MatchMusic.ts`
- Modify: `src/debug-globals.d.ts`
- Test: `tests/unit/MatchMusic.test.ts`

- [ ] **Step 1: Добавить тип __debugMusic в debug-globals.d.ts**

В `src/debug-globals.d.ts`, внутри `interface Window`, после строки `__debugLeave?: () => void` добавить:

```ts
    __debugMusic?: () => { loopIndex: number; active: string[] }
```

- [ ] **Step 2: Написать падающий тест MatchMusic (фейк-движок)**

```ts
// tests/unit/MatchMusic.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MatchMusic } from '../../src/game/audio/MatchMusic'
import type { IMusicEngine, Arrangement, StemLibrary } from '../../src/game/audio/types'

class FakeEngine implements IMusicEngine {
  loadCalls = 0
  startCalls = 0
  provider: ((loopIndex: number) => Arrangement) | null = null
  loopIndex = 0
  async load(_lib: StemLibrary) { this.loadCalls++ }
  async start(provider: (i: number) => Arrangement) { this.startCalls++; this.provider = provider }
  stop() {}
  setMasterGain() {}
  dispose() {}
  activeStemIds() { return [] }
}

afterEach(() => { delete (window as Window).__debugMusic })

describe('MatchMusic', () => {
  it('start(): сначала load, потом start с provider', async () => {
    const eng = new FakeEngine()
    await new MatchMusic('AB12', eng).start()
    expect(eng.loadCalls).toBe(1)
    expect(eng.startCalls).toBe(1)
    expect(eng.provider).toBeTypeOf('function')
  })

  it('provider даёт детерминированную интро-аранжировку (kicks+bass) на loop 0', async () => {
    const eng = new FakeEngine()
    await new MatchMusic('AB12', eng).start()
    const roles = eng.provider!(0).map(v => v.role).sort()
    expect(roles).toEqual(['bass', 'kicks'])
  })

  it('одинаковый код → одинаковый provider-выход (детерминизм от сида)', async () => {
    const e1 = new FakeEngine(); await new MatchMusic('ZZZZ', e1).start()
    const e2 = new FakeEngine(); await new MatchMusic('ZZZZ', e2).start()
    expect(e1.provider!(3)).toEqual(e2.provider!(3))
  })

  it('start() идемпотентен', async () => {
    const eng = new FakeEngine()
    const m = new MatchMusic('AB12', eng)
    await m.start(); await m.start()
    expect(eng.startCalls).toBe(1)
  })

  it('устанавливает и снимает window.__debugMusic', async () => {
    const eng = new FakeEngine()
    const m = new MatchMusic('AB12', eng)
    expect(window.__debugMusic).toBeTypeOf('function')
    m.dispose()
    expect(window.__debugMusic).toBeUndefined()
  })
})
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/MatchMusic.test.ts`
Expected: FAIL — модуль `MatchMusic` не найден.

- [ ] **Step 4: Реализовать MatchMusic.ts**

Примечание: `erasableSyntaxOnly` запрещает parameter properties — поля объявляем явно и присваиваем в теле конструктора.

```ts
// src/game/audio/MatchMusic.ts
import type { IMusicEngine } from './types'
import { STEM_LIBRARY } from './stems'
import { MusicDirector } from './MusicDirector'
import { hashSeed } from './rng'

/** Связывает сид (из лобби-кода) + директора с движком; владеет жизненным циклом музыки матча. */
export class MatchMusic {
  private readonly seed: number
  private readonly engine: IMusicEngine
  private readonly director = new MusicDirector()
  private started = false

  constructor(seedCode: string, engine: IMusicEngine) {
    this.engine = engine
    this.seed = hashSeed(seedCode)
    window.__debugMusic = () => ({ loopIndex: engine.loopIndex, active: engine.activeStemIds() })
  }

  /** Заводится один раз на переходе матча в live. Идемпотентно. */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.engine.load(STEM_LIBRARY)
    await this.engine.start(loopIndex => this.director.compose(this.seed, loopIndex, STEM_LIBRARY))
  }

  dispose(): void {
    this.engine.dispose()
    delete window.__debugMusic
  }
}
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npx vitest run --config vitest.config.ts tests/unit/MatchMusic.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 6: Коммит**

```bash
git add src/game/audio/MatchMusic.ts src/debug-globals.d.ts tests/unit/MatchMusic.test.ts
git commit -m "feat(audio): MatchMusic — связка сид+директор+движок, __debugMusic"
```

---

## Task 7: Подключить музыку к Match

**Files:**
- Modify: `src/game/Match.ts` (интерфейс `MatchOptions` ~46-57; конструктор ~102-120; `tickPhase` ~310-325; `dispose` ~556-568)
- Test: `tests/unit/Match.music.test.ts`

- [ ] **Step 1: Добавить импорты в Match.ts**

После существующих импортов (рядом с `import { MAPS } from './maps'`) добавить:

```ts
import type { IMusicEngine } from './audio/types'
import { MatchMusic } from './audio/MatchMusic'
```

- [ ] **Step 2: Расширить MatchOptions**

В `interface MatchOptions` (после `mapId?: MapId`) добавить два поля:

```ts
  seedCode?: string         // источник сида музыки (лобби-код); общий у обоих пиров
  musicEngine?: IMusicEngine  // движок музыки (DIP); нет в юнит-тестах → музыка выключена
```

- [ ] **Step 3: Добавить поля и создание MatchMusic в конструкторе**

Рядом с другими приватными полями класса `Match` добавить:

```ts
  private music: MatchMusic | null = null
  private musicStarted = false
```

В конце конструктора (после `if (opponentIsBot) this.readySet.add(OPPONENT_ID)`) добавить:

```ts
    // Музыка матча: только если переданы сид и движок (в юнит-тестах их нет → тишина).
    if (o.seedCode && o.musicEngine) this.music = new MatchMusic(o.seedCode, o.musicEngine)
```

- [ ] **Step 4: Завести музыку на переходе в live (в tickPhase)**

В методе `tickPhase`, в самом конце (после блока `if (this.pendingResult ...)`), добавить:

```ts
    // Музыка стартует один раз при входе в бой — покрывает все пути в live
    // (host countdown→live, client applyHostPhase, forceLiveForTest).
    if (this.phase === 'live' && !this.musicStarted) {
      this.musicStarted = true
      void this.music?.start()
    }
```

- [ ] **Step 5: Остановить музыку в dispose**

В методе `dispose()`, после `this.players.forEach(p => p.dispose())`, добавить:

```ts
    this.music?.dispose()
```

- [ ] **Step 6: Написать тест Match с фейк-движком**

```ts
// tests/unit/Match.music.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { IMusicEngine, Arrangement, StemLibrary } from '../../src/game/audio/types'
import type { RosterEntry } from '../../src/net/protocol'

class FakeEngine implements IMusicEngine {
  startCalls = 0
  loopIndex = 0
  async load(_lib: StemLibrary) {}
  async start(_p: (i: number) => Arrangement) { this.startCalls++ }
  stop() {}
  setMasterGain() {}
  dispose() {}
  activeStemIds() { return [] }
}

function makeMatch(opts: { seedCode?: string; musicEngine?: IMusicEngine }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const controls = { current: { pointerSpeed: 1 } }
  const keys = { current: { forward: false, back: false, left: false, right: false } }
  const roster: RosterEntry[] = [
    { id: 0, name: 'Вы', color: '#4af', kind: 'human' },
    { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty: 'passive' },
  ]
  return new Match({
    scene, camera, controls: controls as any, keys: keys as any, dispatch: vi.fn(),
    role: 'host', netConfig: { localId: 0, roster }, ...opts,
  })
}

afterEach(() => { delete (window as Window).__debugMusic })

describe('Match × музыка', () => {
  it('без musicEngine музыка не создаётся, update не падает', () => {
    const m = makeMatch({})
    m.forceLiveForTest()
    expect(() => m.update(0.016)).not.toThrow()
    expect(window.__debugMusic).toBeUndefined()
  })

  it('с сидом и движком стартует музыку при входе в live', async () => {
    const eng = new FakeEngine()
    const m = makeMatch({ seedCode: 'AB12', musicEngine: eng })
    m.forceLiveForTest()
    m.update(0.016)
    await vi.waitFor(() => expect(eng.startCalls).toBe(1))
  })

  it('dispose() снимает __debugMusic', () => {
    const m = makeMatch({ seedCode: 'AB12', musicEngine: new FakeEngine() })
    expect(window.__debugMusic).toBeTypeOf('function')
    m.dispose()
    expect(window.__debugMusic).toBeUndefined()
  })
})
```

- [ ] **Step 7: Запустить тест — убедиться, что проходит**

Run: `npx vitest run --config vitest.config.ts tests/unit/Match.music.test.ts`
Expected: PASS (3 теста). Если `update` не зовёт `tickPhase` — проверь, что блок из Step 4 действительно в `tickPhase`, а `tickPhase` вызывается из `update`.

- [ ] **Step 8: Прогнать существующие тесты Match (регрессия)**

Run: `npx vitest run --config vitest.config.ts tests/unit/Match.test.ts`
Expected: PASS — старые тесты не сломаны (музыка выключена без движка).

- [ ] **Step 9: Коммит**

```bash
git add src/game/Match.ts tests/unit/Match.music.test.ts
git commit -m "feat(audio): Match заводит музыку на live, гасит на dispose"
```

---

## Task 8: Проложить seedCode от лобби до Match

**Files:**
- Modify: `src/Game.tsx` (импорт; `GameProps` ~21-31; `useMemo` Match ~38-54)
- Modify: `src/App.tsx` (`GameNet` ~50-57; `onStart` ~114-121; рендер `<Game>` ~321-331)

Без юнит-теста (R3F/App не идут в jsdom) — покрытие в Task 9 (e2e).

- [ ] **Step 1: Game.tsx — импорт движка**

После `import { Match } from './game/Match'` добавить:

```ts
import { WebAudioMusicEngine } from './game/audio/WebAudioMusicEngine'
```

- [ ] **Step 2: Game.tsx — добавить проп seedCode**

В `interface GameProps` (после `mapId: MapId`) добавить:

```ts
  seedCode: string
```

И в деструктуризацию параметров `Game(...)` добавить `seedCode`:

```ts
export function Game({ dispatch, role, net, netConfig, peerToPlayer, defaultThirdPerson, apiRef, durationMs, mapId, seedCode }: GameProps) {
```

- [ ] **Step 3: Game.tsx — передать в Match**

В объекте `new Match({ ... })` (внутри `useMemo`), после `mapId,` добавить:

```ts
      seedCode,
      musicEngine: new WebAudioMusicEngine(),
```

- [ ] **Step 4: App.tsx — добавить code в GameNet**

В `interface GameNet` (после `mapId: MapId`) добавить:

```ts
  code: string
```

- [ ] **Step 5: App.tsx — заполнить code в onStart**

В `session.onStart(...)` найти `setGameNet({ role: matchRole, net, netConfig: session.netConfig(), peerToPlayer: new Map(session.hostPeerToPlayer()), durationMs, mapId })` и добавить в объект `, code` (переменная `code` — параметр внешней `enterLobby`):

```ts
      setGameNet({ role: matchRole, net, netConfig: session.netConfig(), peerToPlayer: new Map(session.hostPeerToPlayer()), durationMs, mapId, code })
```

- [ ] **Step 6: App.tsx — передать seedCode в <Game>**

В JSX `<Game ... />` после `mapId={gameNet.mapId}` добавить:

```tsx
              seedCode={gameNet.code}
```

- [ ] **Step 7: Проверить типы и сборку**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 8: Коммит**

```bash
git add src/Game.tsx src/App.tsx
git commit -m "feat(audio): прокладка лобби-кода как сида музыки в Match"
```

---

## Task 9: e2e дымовой тест

**Files:**
- Create: `tests/music.spec.ts`

- [ ] **Step 1: Написать e2e-тест**

`waitForGame` проходит меню реальными кликами (есть user-gesture для `AudioContext.resume()`), затем `__debugForceLive` → музыка стартует. Декод 59 стемов + первый луп требуют времени — ждём `__debugMusic().active` непустым.

```ts
// tests/music.spec.ts
import { test, expect } from './fixtures'
import { waitForGame } from './helpers'

test('музыка стартует в live: AudioContext активен, источники запланированы', async ({ page }) => {
  await page.goto('/')
  await waitForGame(page, { difficulty: 'passive' })

  // Ждём, пока движок задекодит стемы и запланирует первый луп.
  await page.waitForFunction(
    () => ((window as any).__debugMusic?.()?.active?.length ?? 0) > 0,
    { timeout: 15000 },
  )

  const music = await page.evaluate(() => (window as any).__debugMusic())
  // Интро: на первом лупе звучат только kicks+bass.
  const roles = music.active.map((id: string) => id.split('/')[0]).sort()
  expect(roles).toEqual(['bass', 'kicks'])
  expect(music.loopIndex).toBeGreaterThanOrEqual(0)
})
```

- [ ] **Step 2: Запустить e2e (нужен запущенный dev-сервер; Playwright поднимет сам)**

Run: `npx playwright test --project=headless tests/music.spec.ts`
Expected: PASS. Если падает по таймауту на `active.length > 0` — проверь в консоли браузера ошибки декода/`AudioContext` (autoplay): меню-клики в `waitForGame` должны дать gesture; при необходимости добавь `--autoplay-policy=no-user-gesture-required` в `launchOptions.args` обоих проектов `playwright.config.ts`.

- [ ] **Step 3: Коммит**

```bash
git add tests/music.spec.ts
git commit -m "test(audio): e2e дымовой — музыка стартует в live (интро kicks+bass)"
```

---

## Task 10: Полный прогон + проверка сборки

- [ ] **Step 1: Канонический прогон тестов**

Run: `npm run test`
Expected: PASS — все юниты (rng, stems, MusicDirector, MatchMusic, Match.music + существующие) и e2e (включая `music.spec.ts`).

- [ ] **Step 2: Полная проверка типов + прод-сборка**

Run: `npm run build`
Expected: `tsc -b` без ошибок; `vite build` собирает (стемы попадают в бандл как ассеты).

- [ ] **Step 3: Линт**

Run: `npm run lint`
Expected: без ошибок.

- [ ] **Step 4: Финальный коммит (если линт что-то поправил)**

```bash
git add -A
git commit -m "chore(audio): финальная чистка после прогона тестов/линта" || echo "нечего коммитить"
```

---

## Self-Review (выполнено при написании плана)

**Покрытие спеки:**
- Модель C + интро kicks+bass → Task 4 (`INTRO_LOOPS`, `compose`). ✅
- Детерминизм от лобби-кода → Task 2 (`hashSeed`), Task 8 (прокладка `code`). ✅
- Lookahead на сетке 8.0с, не по длине файла → Task 5 (`LOOP_SECONDS`, `src.stop(when+LOOP_SECONDS)`). ✅
- Кроссфейд вступающих голосов → Task 5 (`FADE_SEC`, ветка `prevIds`). ✅
- Роль = папка, манифест через glob → Task 3. ✅
- `MusicDirector` — единственное место правил → Task 4. ✅
- Старт на `live`, стоп на `dispose` → Task 7. ✅
- `prebake.strudel` не в игру → Task 1. ✅
- Юнит: детерминизм compose; e2e: дымовой → Tasks 4, 6, 9. ✅
- Autoplay/gesture → Task 9 (меню-клики дают gesture, фолбэк-флаг в заметке). ✅

**Тип-консистентность:** `IMusicEngine` (load/start/stop/setMasterGain/dispose/loopIndex/activeStemIds) одинаков в `types.ts`, `WebAudioMusicEngine`, фейках (Tasks 6,7). `compose(seed, loopIndex, library)` — единая сигнатура в Tasks 4,6. `StemLibrary`/`Arrangement`/`VoiceSpec` из одного `types.ts`.

**Плейсхолдеры:** нет — весь код приведён целиком.
