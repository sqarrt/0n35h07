# Музыкальная форма фонового трека — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить плоскую подмену стемов детерминированной песенной формой (арка интро→тело→аутро) с узнаваемыми мотивами и лёгкой вариацией.

**Architecture:** Вся логика — в чистом `MusicDirector.compose(seed, loopIndex, library, remainingMs)` (единственное место правил). Тип секции считается из позиции в матче: аутро по остатку времени, интро по началу, тело — повторяющийся паттерн куплет/припев/бридж/соло. Стемы стабильны внутри секции (лечит «кашу»), фундамент (bass/kicks) единый по матчу, цвет (lead/sfx) — по типу секции с ротацией вариантов. Движок (`WebAudioMusicEngine`) не меняется — он уже кроссфейдит подмены и ввод/вывод голосов. Геймплей музыку больше не двигает (`firstBloodDone` убирается).

**Tech Stack:** TypeScript 6 (`erasableSyntaxOnly` — никаких enum/parameter-properties), Vitest (юниты), Playwright (e2e). Детерминизм — `mulberry32`/`hashSeed` из `src/game/audio/rng.ts`.

**Спека:** `docs/superpowers/specs/2026-06-08-music-track-structure-design.md`

---

## Контекст для исполнителя

Текущая реализация (на ветке `feat/audio`):
- `src/game/audio/types.ts` — типы; есть `export type MusicSection = 'intro' | 'full' | 'finale'` (будет удалён).
- `src/game/audio/MusicDirector.ts` — старый `compose(seed, loopIndex, library, section)` (будет переписан).
- `src/game/audio/MatchMusic.ts` — связывает сид+директор+движок; зовёт `compose(..., getSection())`.
- `src/game/audio/WebAudioMusicEngine.ts` — Web Audio движок (НЕ трогаем).
- `src/game/audio/rng.ts` — `hashSeed(str): number`, `mulberry32(seed): () => number`.
- `src/game/audio/stems.ts` — `STEM_LIBRARY: StemLibrary`.
- `src/game/Match.ts` — владеет музыкой; есть `firstBloodDone`, `musicSection()`, `MUSIC_FINALE_MS`, `lastRemainingMs`, `lastRemainingAt`.

Прогон тестов:
- Все юниты музыки: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts tests/unit/MatchMusic.test.ts tests/unit/Match.music.test.ts`
- Типы: `npx tsc -b --noEmit`
- e2e музыки: `npx playwright test --project=headless tests/music.spec.ts`
- Полный канон: `npm run test`

---

## Task 1: Переписать MusicDirector на песенную форму + миграция контракта

Это атомарная миграция: меняется сигнатура `compose`, поэтому в одном коммите правятся директор, типы и все вызывающие (`MatchMusic`, `Match`) + их тесты. Орнамент (второй лид на один луп) добавляется отдельно в Task 2.

**Files:**
- Modify: `src/game/audio/types.ts` (удалить `MusicSection`)
- Modify: `src/game/audio/MusicDirector.ts` (полный переписать)
- Modify: `src/game/audio/MatchMusic.ts` (getRemainingMs вместо getSection)
- Modify: `src/game/Match.ts` (убрать firstBloodDone/musicSection/MUSIC_FINALE_MS; добавить musicRemainingMs)
- Test: `tests/unit/MusicDirector.test.ts` (переписать)
- Test: `tests/unit/MatchMusic.test.ts` (правки под новый аргумент)

- [ ] **Step 1: Переписать юнит-тест MusicDirector под новую форму (падающий)**

Заменить ВЕСЬ файл `tests/unit/MusicDirector.test.ts` на:

```ts
import { describe, it, expect } from 'vitest'
import { MusicDirector } from '../../src/game/audio/MusicDirector'
import type { StemLibrary } from '../../src/game/audio/types'

// Синтетическая библиотека — тесты не зависят от реальных ассетов.
const LIB: StemLibrary = {
  bass:  Array.from({ length: 4 }, (_, i) => ({ id: `bass/b${i}`, url: `b${i}` })),
  kicks: Array.from({ length: 6 }, (_, i) => ({ id: `kicks/k${i}`, url: `k${i}` })),
  lead:  Array.from({ length: 6 }, (_, i) => ({ id: `lead/l${i}`, url: `l${i}` })),
  sfx:   Array.from({ length: 4 }, (_, i) => ({ id: `sfx/s${i}`, url: `s${i}` })),
}
const FAR = 10 * 60_000        // далеко до конца матча → не аутро
const OUTRO = 5_000            // ≤ OUTRO_MS → аутро
const rolesOf = (arr: { role: string }[]) => arr.map(v => v.role).sort()
const leadId = (arr: { role: string; stemId: string }[]) => arr.find(v => v.role === 'lead')!.stemId
const d = new MusicDirector()

describe('MusicDirector.compose — песенная форма', () => {
  it('детерминирован: одинаковые входы → одинаковая аранжировка', () => {
    expect(d.compose(42, 9, LIB, FAR)).toEqual(d.compose(42, 9, LIB, FAR))
  })

  it('интро в начале матча: kicks+bass, стемы стабильны внутри секции', () => {
    for (const loop of [0, 1, 2, 3]) expect(rolesOf(d.compose(42, loop, LIB, FAR))).toEqual(['bass', 'kicks'])
    const ids = (loop: number) => d.compose(42, loop, LIB, FAR).map(v => v.stemId).sort()
    expect(ids(0)).toEqual(ids(3))   // внутри интро стемы не дёргаются
  })

  it('аутро по остатку времени: kicks+lead (независимо от loopIndex)', () => {
    expect(rolesOf(d.compose(42, 100, LIB, OUTRO))).toEqual(['kicks', 'lead'])
  })

  it('аутро берёт лид припева (вариант 0)', () => {
    // первый припев: интро(4)+куплет(4) → абс. лупы 8..11, occurrence 0, вариант 0
    expect(leadId(d.compose(42, 200, LIB, OUTRO))).toBe(leadId(d.compose(42, 9, LIB, FAR)))
  })

  it('секции тела: верные наборы ролей', () => {
    expect(rolesOf(d.compose(42, 4, LIB, FAR))).toEqual(['bass', 'kicks', 'lead', 'sfx'])   // куплет (абс 4..7)
    expect(rolesOf(d.compose(42, 20, LIB, FAR))).toEqual(['bass', 'sfx'])                    // бридж (абс 20..21)
    expect(rolesOf(d.compose(42, 22, LIB, FAR))).toEqual(['kicks', 'lead'])                  // соло (абс 22..25)
  })

  it('вариация: куплеты ротируют лид по пулу (occ0≠occ1, occ0==occ3)', () => {
    // куплеты начинаются на абс. лупах: 4 (occ0), 12 (occ1), затем +26: 30 (occ2), 38 (occ3)
    const o0 = leadId(d.compose(42, 4, LIB, FAR))
    const o1 = leadId(d.compose(42, 12, LIB, FAR))
    const o3 = leadId(d.compose(42, 38, LIB, FAR))
    expect(o0).not.toBe(o1)   // соседние повторы — разные варианты
    expect(o0).toBe(o3)       // период пула (COLOR_POOL=3) → occ0 и occ3 совпадают
  })

  it('лид куплета и лид припева различны (узнаваемость секций)', () => {
    expect(leadId(d.compose(42, 4, LIB, FAR))).not.toBe(leadId(d.compose(42, 8, LIB, FAR)))
  })

  it('все stemId существуют в библиотеке; gain положительный', () => {
    const all = new Set(Object.values(LIB).flat().map(s => s.id))
    for (const v of d.compose(7, 9, LIB, FAR)) {
      expect(all.has(v.stemId)).toBe(true)
      expect(v.gain).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts`
Expected: FAIL (старый `compose` имеет другую сигнатуру/поведение; нет интро на абс. лупах, тело не реализовано).

- [ ] **Step 3: Удалить `MusicSection` из типов**

В `src/game/audio/types.ts` удалить блок:

```ts
/** Музыкальная секция матча — задаётся состоянием боя, а не временем лупа:
 *  intro — до первого убийства; full — основная фаза; finale — последние секунды матча. */
export type MusicSection = 'intro' | 'full' | 'finale'
```

(Остальные типы — `Role`, `ROLES`, `StemRef`, `StemLibrary`, `VoiceSpec`, `Arrangement`, `IMusicEngine` — оставить как есть.)

- [ ] **Step 4: Переписать MusicDirector целиком**

Заменить ВЕСЬ файл `src/game/audio/MusicDirector.ts` на:

```ts
import type { Role, StemLibrary, Arrangement, VoiceSpec } from './types'
import { mulberry32, hashSeed } from './rng'

// --- ПРАВИЛА КОМПОЗИЦИИ (единственное место; тюнятся здесь) ---

// Типы секций песенной формы: intro/outro — края арки, остальные — тело.
type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro'

const INTRO_LOOPS = 4          // длина интро (лупов) в начале матча
const OUTRO_MS = 16_000        // последние N мс матча — аутро
const SECTION_LOOPS: Record<SectionType, number> = {
  intro: INTRO_LOOPS, verse: 4, chorus: 4, bridge: 2, solo: 4, outro: 1,
}
// Паттерн тела — повторяется, добивая хронометраж; стемы варьируются на повторах.
const BODY_PATTERN: SectionType[] = ['verse', 'chorus', 'verse', 'chorus', 'bridge', 'solo', 'chorus']
const PATTERN_LOOPS = BODY_PATTERN.reduce((n, s) => n + SECTION_LOOPS[s], 0)

const SECTION_ROLES: Record<SectionType, Role[]> = {
  intro:  ['kicks', 'bass'],
  verse:  ['kicks', 'bass', 'sfx', 'lead'],
  chorus: ['kicks', 'bass', 'sfx', 'lead'],
  bridge: ['bass', 'sfx'],
  solo:   ['kicks', 'lead'],
  outro:  ['kicks', 'lead'],
}

const FOUNDATION_ROLES: Role[] = ['bass', 'kicks']   // фундамент: единый по матчу, медленная ротация
const FOUNDATION_POOL = 2      // вариантов фундамента (ротация раз в проход паттерна тела)
const COLOR_POOL = 3           // вариантов цвета (lead/sfx) на тип секции

const ROLE_GAIN: Record<Role, number> = { bass: 0.9, kicks: 1.0, lead: 0.7, sfx: 0.5 }
const ROLE_SALT: Record<Role, number> = { bass: 0x1111, kicks: 0x2222, lead: 0x3333, sfx: 0x4444 }

interface SectionPos { type: SectionType; occurrence: number; loopInSection: number; loops: number }

/** Тип и позиция секции по месту в матче: аутро — по остатку времени, интро — по началу, иначе тело. */
function sectionAt(loopIndex: number, remainingMs: number): SectionPos {
  if (remainingMs <= OUTRO_MS) return { type: 'outro', occurrence: 0, loopInSection: 0, loops: SECTION_LOOPS.outro }
  if (loopIndex < INTRO_LOOPS) return { type: 'intro', occurrence: 0, loopInSection: loopIndex, loops: INTRO_LOOPS }
  let bodyLoop = loopIndex - INTRO_LOOPS
  const occ: Partial<Record<SectionType, number>> = {}
  for (let i = 0; ; i++) {
    const type = BODY_PATTERN[i % BODY_PATTERN.length]
    const loops = SECTION_LOOPS[type]
    const occurrence = occ[type] ?? 0
    if (bodyLoop < loops) return { type, occurrence, loopInSection: bodyLoop, loops }
    bodyLoop -= loops
    occ[type] = occurrence + 1
  }
}

/** Детерминированный выбор стема: база от (роль+ключ-секции), вариант сдвигает индекс →
 *  разные варианты дают РАЗНЫЕ стемы (узнаваемость + гарантированная вариация). */
function pickStem(seed: number, role: Role, key: string, variant: number, library: StemLibrary, gain: number): VoiceSpec | null {
  const stems = library[role]
  if (stems.length === 0) return null
  const base = Math.floor(mulberry32((seed ^ ROLE_SALT[role] ^ hashSeed(key)) >>> 0)() * stems.length)
  const idx = (base + variant) % stems.length
  return { role, stemId: stems[idx].id, gain }
}

/** Голос роли для секции: фундамент (bass/kicks) — единый по матчу; цвет (lead/sfx) — по типу секции;
 *  лид аутро заимствует хук припева (вариант 0). */
function voiceFor(role: Role, pos: SectionPos, foundationVariant: number, seed: number, library: StemLibrary): VoiceSpec | null {
  if (role === 'lead' && pos.type === 'outro') return pickStem(seed, 'lead', 'chorus', 0, library, ROLE_GAIN.lead)
  if (FOUNDATION_ROLES.includes(role)) return pickStem(seed, role, 'foundation', foundationVariant, library, ROLE_GAIN[role])
  return pickStem(seed, role, pos.type, pos.occurrence % COLOR_POOL, library, ROLE_GAIN[role])
}

/** Чистая детерминированная композиция. Единственное место музыкальных правил. */
export class MusicDirector {
  compose(seed: number, loopIndex: number, library: StemLibrary, remainingMs: number): Arrangement {
    const pos = sectionAt(loopIndex, remainingMs)
    const foundationVariant = Math.floor(loopIndex / PATTERN_LOOPS) % FOUNDATION_POOL
    const voices: VoiceSpec[] = []
    for (const role of SECTION_ROLES[pos.type]) {
      const v = voiceFor(role, pos, foundationVariant, seed, library)
      if (v) voices.push(v)
    }
    return voices
  }
}
```

- [ ] **Step 5: Обновить MatchMusic — getRemainingMs вместо getSection**

Заменить ВЕСЬ файл `src/game/audio/MatchMusic.ts` на:

```ts
import type { IMusicEngine } from './types'
import { STEM_LIBRARY } from './stems'
import { MusicDirector } from './MusicDirector'
import { hashSeed } from './rng'

/** Связывает сид (из лобби-кода) + директора с движком; владеет жизненным циклом музыки матча.
 *  Остаток времени матча (для аутро) спрашивает у матча через getRemainingMs — он синхронен у пиров. */
export class MatchMusic {
  private readonly seed: number
  private readonly engine: IMusicEngine
  private readonly getRemainingMs: () => number
  private readonly director = new MusicDirector()
  private started = false

  constructor(seedCode: string, engine: IMusicEngine, getRemainingMs: () => number) {
    this.engine = engine
    this.getRemainingMs = getRemainingMs
    this.seed = hashSeed(seedCode)
  }

  /** Заводится один раз на входе в бой (countdown/live). Идемпотентно.
   *  __debugMusic ставится ЗДЕСЬ, а не в конструкторе: useMemo в Game под React.StrictMode
   *  дважды инстанцирует Match (и движок), но start() зовётся только у закоммиченного — иначе
   *  глобал указывал бы на выброшенный движок, который никогда не планировал лупы. */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    const engine = this.engine
    window.__debugMusic = () => ({ loopIndex: engine.loopIndex, active: engine.activeStemIds() })
    await engine.load(STEM_LIBRARY)
    await engine.start(loopIndex => this.director.compose(this.seed, loopIndex, STEM_LIBRARY, this.getRemainingMs()))
  }

  /** Плавно гасит музыку на завершении матча. Безопасно звать до старта (no-op). */
  fadeOut(): void {
    if (this.started) this.engine.fadeOut()
  }

  dispose(): void {
    this.engine.dispose()
    delete window.__debugMusic
  }
}
```

- [ ] **Step 6: Обновить Match — убрать firstBlood/musicSection/MUSIC_FINALE_MS, добавить musicRemainingMs**

В `src/game/Match.ts` сделать пять правок:

(a) Импорт типов (строка ~17): убрать `MusicSection`:
```ts
import type { IMusicEngine } from './audio/types'
```

(b) Удалить константу (строка ~31):
```ts
const MUSIC_FINALE_MS = 10_000   // последние N мс матча — музыкальная секция finale (kicks+lead)
```

(c) Удалить поле `firstBloodDone` (строка ~110). Было:
```ts
  private firstBloodDone = false        // было ли первое убийство (intro→full)
  private lastRemainingMs = Infinity    // остаток матча (host считает, client получает в 'time') — для finale
```
Стало:
```ts
  private lastRemainingMs = Infinity    // остаток матча (host считает, client получает в 'time') — для аутро музыки
```

(d) В конструкторе (строка ~134) поменять колбэк:
```ts
    if (o.seedCode && o.musicEngine) this.music = new MatchMusic(o.seedCode, o.musicEngine, () => this.musicRemainingMs())
```

(e) Заменить метод `musicSection()` (строки ~349-357) на `musicRemainingMs()`:
```ts
  /** Остаток матча в мс для музыки (Infinity до старта часов) — по нему MusicDirector решает аутро. */
  private musicRemainingMs(): number {
    if (!Number.isFinite(this.lastRemainingMs)) return Infinity
    return Math.max(0, this.lastRemainingMs - (Date.now() - this.lastRemainingAt))
  }
```

(f) Удалить обе строки присвоения `firstBloodDone` — host (строка ~294) и client (строка ~541):
```ts
            this.firstBloodDone = true   // intro → full (музыка)
```
```ts
        this.firstBloodDone = true   // intro → full (музыка, клиентская сторона)
```

- [ ] **Step 7: Поправить MatchMusic.test.ts под новый аргумент**

В `tests/unit/MatchMusic.test.ts`:

(a) Убрать `MusicSection` из импорта и заменить хелпер `intro` на `far`:
```ts
import type { IMusicEngine, Arrangement, StemLibrary } from '../../src/game/audio/types'
```
```ts
const far = () => 10 * 60_000   // далеко до конца → интро на старте
```

(b) Во всех конструкторах `new MatchMusic('CODE', eng, intro)` заменить третий аргумент `intro` → `far`. Затронутые места: `'AB12', eng, intro` (×несколько), `'ZZZZ', e1, intro`, `'ZZZZ', e2, intro`, `'AB12', eng, intro` в тесте идемпотентности и в тесте `__debugMusic`. Тело тестов не меняется (на loop 0/3 с большим остатком — интро = kicks+bass).

- [ ] **Step 8: Запустить юниты музыки — убедиться, что зелёные**

Run: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts tests/unit/MatchMusic.test.ts tests/unit/Match.music.test.ts`
Expected: PASS (все три файла).

- [ ] **Step 9: Проверить типы**

Run: `npx tsc -b --noEmit`
Expected: без ошибок (нет висячих ссылок на `MusicSection`/`firstBloodDone`/`MUSIC_FINALE_MS`).

Если `tsc` ругается на оставшуюся ссылку `MusicSection` где-то ещё — найти и убрать:
Run: `npx playwright --version` (не нужно); вместо этого grep по исходникам — использовать поиск в IDE/`Grep` по `MusicSection`. Ожидание: совпадений в `src/` нет.

- [ ] **Step 10: Коммит**

```bash
git add src/game/audio/types.ts src/game/audio/MusicDirector.ts src/game/audio/MatchMusic.ts src/game/Match.ts tests/unit/MusicDirector.test.ts tests/unit/MatchMusic.test.ts
git commit -m "feat(audio): песенная форма трека (арка интро/тело/аутро), миграция контракта compose"
```

---

## Task 2: Орнамент — второй лид на один луп в конце припева/соло

**Files:**
- Modify: `src/game/audio/MusicDirector.ts` (добавить `ornamentLead` + вызов в `compose`)
- Test: `tests/unit/MusicDirector.test.ts` (добавить тест орнамента)

- [ ] **Step 1: Добавить падающий тест орнамента**

В `tests/unit/MusicDirector.test.ts` добавить внутри `describe(...)` ещё один тест:

```ts
  it('орнамент: на последнем лупе припева — второй (отличный) лид, в середине — один', () => {
    const leads = (loop: number) => d.compose(42, loop, LIB, FAR).filter(v => v.role === 'lead')
    expect(leads(8).length).toBe(1)             // начало первого припева (абс 8) — один лид
    expect(leads(11).length).toBe(2)            // последний луп припева (абс 11) — добавлен второй лид
    expect(new Set(leads(11).map(v => v.stemId)).size).toBe(2)   // два разных лида
  })
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts -t "орнамент"`
Expected: FAIL (`leads(11).length` равно 1 — орнамента ещё нет).

- [ ] **Step 3: Реализовать орнамент**

В `src/game/audio/MusicDirector.ts` добавить константу рядом с другими:

```ts
const ORNAMENT_GAIN = 0.5      // гейн второго лида на одно-луповом орнаменте
```

Добавить функцию перед классом `MusicDirector` (после `voiceFor`):

```ts
/** Орнамент: второй лид на ПОСЛЕДНЕМ лупе припева/соло — короткая «перекличка» лид-на-лид.
 *  Источник: для припева — лид куплета, для соло — лид припева. Гарантированно отличен от лида секции. */
function ornamentLead(pos: SectionPos, primaryLeadId: string | undefined, seed: number, library: StemLibrary): VoiceSpec | null {
  if (pos.loopInSection !== pos.loops - 1) return null
  const srcKey = pos.type === 'chorus' ? 'verse' : pos.type === 'solo' ? 'chorus' : null
  if (srcKey === null) return null
  const v = pickStem(seed, 'lead', srcKey, pos.occurrence % COLOR_POOL, library, ORNAMENT_GAIN)
  if (!v) return null
  let stemId = v.stemId
  if (stemId === primaryLeadId) {                 // гарантируем различие двух лидов
    const leads = library.lead
    const i = leads.findIndex(s => s.id === stemId)
    stemId = leads[(i + 1) % leads.length].id
    if (stemId === primaryLeadId) return null      // в библиотеке один лид — орнамент пропускаем
  }
  return { role: 'lead', stemId, gain: ORNAMENT_GAIN }
}
```

В методе `compose` добавить орнамент после основного цикла, перед `return voices`:

```ts
  compose(seed: number, loopIndex: number, library: StemLibrary, remainingMs: number): Arrangement {
    const pos = sectionAt(loopIndex, remainingMs)
    const foundationVariant = Math.floor(loopIndex / PATTERN_LOOPS) % FOUNDATION_POOL
    const voices: VoiceSpec[] = []
    for (const role of SECTION_ROLES[pos.type]) {
      const v = voiceFor(role, pos, foundationVariant, seed, library)
      if (v) voices.push(v)
    }
    const orn = ornamentLead(pos, voices.find(v => v.role === 'lead')?.stemId, seed, library)
    if (orn && !voices.some(v => v.stemId === orn.stemId)) voices.push(orn)
    return voices
  }
```

- [ ] **Step 4: Запустить тест орнамента — зелёный**

Run: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts -t "орнамент"`
Expected: PASS.

- [ ] **Step 5: Прогнать весь файл MusicDirector — ничего не сломалось**

Run: `npx vitest run --config vitest.config.ts tests/unit/MusicDirector.test.ts`
Expected: PASS (все тесты, включая аутро/секции — орнамент не трогает аутро и середины секций).

- [ ] **Step 6: Коммит**

```bash
git add src/game/audio/MusicDirector.ts tests/unit/MusicDirector.test.ts
git commit -m "feat(audio): орнамент — второй лид на один луп в конце припева/соло"
```

---

## Task 3: Полная верификация (e2e, типы, lint, канон)

**Files:** нет правок кода (только проверка; мелкие фиксы по результату).

- [ ] **Step 1: e2e-смоук музыки — интро на старте всё ещё kicks+bass**

Run: `npx playwright test --project=headless tests/music.spec.ts`
Expected: PASS. (Тест ждёт активных источников и проверяет роли `['bass','kicks']` — это теперь музыкальное интро на абс. лупах 0..3, состав не изменился.)

Если упал из-за того, что движок к моменту замера ушёл за интро (маловероятно — интро 32с, тест ~4с): не «чинить» подгонкой; разобраться, почему loopIndex так велик, и сообщить.

- [ ] **Step 2: Типы**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: без ошибок (неиспользуемых импортов `MusicSection` и т.п. не осталось).

- [ ] **Step 4: Полный канонический прогон**

Run: `npm run test`
Expected: все юниты + e2e зелёные (возможен 1 предсуществующий flaky `shield.spec`/`multiplayer.spec` по таймингу — не связан с аудио; проходит на ретрае).

- [ ] **Step 5: Сверка со спекой (self-review)**

Пройтись по спеке `docs/superpowers/specs/2026-06-08-music-track-structure-design.md` и убедиться, что реализовано: арка интро/тело/аутро; firstBlood убран; фундамент/цвет; пулы вариаций; аутро берёт лид припева; орнамент. Если что-то не закрыто — отметить и доделать отдельной задачей.

- [ ] **Step 6: Финальный коммит (если были мелкие фиксы)**

```bash
git add -A
git commit -m "test(audio): верификация песенной формы (e2e/типы/lint/канон)"
```

(Если правок не было — шаг пропустить.)

---

## Заметки по граблям

- **Детерминизм/синхрон пиров:** всё — чистые функции от `loopIndex` (общий из синхронного старта ритуала) и `seed` (общий из лобби-кода). `remainingMs` хост-авторитетно синхронизируется (как сейчас для finale). Семпл-синхрон не нужен — совпадает последовательность аранжировок.
- **`erasableSyntaxOnly`:** `type SectionType = ...` — алиас (стираемо), ок. Никаких `enum`. Поля классов объявляй явно.
- **Движок не трогаем:** орнамент-голос живёт один луп → движок сам кроссфейдит его ввод и хвостом выводит на следующей границе (логика подмены уже есть).
- **Библиотека:** bass всего 7 — поэтому он «фундамент» (общий пул, не по секциям). Если позже добавят бас-стемы, можно поднять `FOUNDATION_POOL`.
- **Коммиты:** многострочные сообщения НЕ передавать через PowerShell here-string в Bash — здесь все сообщения однострочные (`-m`), безопасно.
