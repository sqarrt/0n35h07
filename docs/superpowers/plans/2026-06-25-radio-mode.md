# Radio Mode — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Цель:** Встроить бесконечный генеративный радиодвижок из `oneshot_music_editor` в игру в виде opt-in режима, заменяющего существующую музыку в меню и матче.

**Архитектура:** `RadioController` + `StrudelWebEngine` (из редактора, скопированы в `src/radio/`) живут в App на том же уровне, что `menuMusic`. Когда радио включено — `menuMusic` замолкает, `Game` получает `NOOP_MUSIC_ENGINE` вместо настоящего. Мини-плеер монтируется во всех меню-экранах и запускает прогрев (lazy import + loadRadioBanks) при монтировании.

**Стек:** @strudel/web (AGPL), React 19, TypeScript 6, Vite 8.

## Глобальные ограничения

- Один файл = одна ответственность; YAGNI; SOLID/DRY/SRP
- Нет магических чисел — только именованные константы
- `@strudel/web` — отдельный lazy chunk (dynamic import)
- `initAudio()` (из @strudel/web) **должна** вызываться внутри обработчика пользовательского жеста
- Кнопки в меню не должны менять размер при смене состояния
- Запускать тесты только после подтверждения изменений пользователем (`npm run test`)
- `erasableSyntaxOnly: true` — запрещены enums, parameter properties, namespaces

---

## Карта файлов

| Файл | Действие |
|---|---|
| `src/radio/index.ts` | Создать — barrel-экспорт всего радиодвижка |
| `src/radio/music/**` | Создать — скопировать из редактора |
| `src/radio/app/RadioController.ts` | Создать — скопировать + поправить 1 импорт |
| `src/radio/app/radioBanks.ts` | Создать — скопировать + поправить 1 импорт |
| `src/radio/trackName.ts` | Создать — `radioTrackName(state) → string` |
| `public/radio/*.json` | Создать — 5 банков (moods/progressions/drums/instruments/scales) |
| `src/settings.ts` | Изменить — добавить `radioEnabled`, `volumeRadio` в профиль |
| `src/App.tsx` | Изменить — радио-стейт, прогрев, переключение, новый экран, мини-плеер |
| `src/screens/MainMenu.tsx` | Изменить — кнопка RADIO |
| `src/screens/Radio.tsx` | Создать — полноэкранный плеер (glass card) |
| `src/components/RadioMiniPlayer.tsx` | Создать — угловой виджет (glass) |
| `src/Game.tsx` | Изменить — prop `radioActive`, NOOP engine при true |
| `src-tauri/tauri.conf.json` | Изменить — CSP для CDN-сэмплов @strudel |
| `tests/unit/radioTrackName.test.ts` | Создать |
| `tests/unit/settings.test.ts` | Изменить — покрыть новые поля |

---

## Задача 1: Установка @strudel/web + копирование движка

**Файлы:**
- Создать: `src/radio/` (всё дерево, см. ниже)
- Создать: `public/radio/*.json`
- Изменить: `package.json`

**Интерфейсы:**
- Производит: `src/radio/index.ts` — barrel со следующими экспортами:
  ```ts
  export { StrudelWebEngine } from './music/StrudelWebEngine'
  export type { IStrudelEngine } from './music/IStrudelEngine'
  export { RadioController, sectionDurationMs } from './app/RadioController'
  export type { RadioEngine, RadioControllerDeps } from './app/RadioController'
  export { loadRadioBanks } from './app/radioBanks'
  export type { FetchLike } from './app/radioBanks'
  export { validateBanks } from './music/radio/banks'
  export type { RadioBanks } from './music/radio/banks'
  export { DEFAULT_RADIO_CONFIG, loadRadioConfig } from './music/radio/radioConfig'
  export type { RadioConfig } from './music/radio/radioConfig'
  export type { MusicalState } from './music/radio/MusicalState'
  ```

- [ ] **Шаг 1: Установить зависимость**

```bash
npm i @strudel/web
```

- [ ] **Шаг 2: Создать директории**

```bash
mkdir -p src/radio/music/radio/engines src/radio/app public/radio
```

- [ ] **Шаг 3: Скопировать файлы движка**

```bash
EDITOR="C:/Users/Home/PycharmProjects/oneshot_music_editor/src"

# Ядро RadioComposer (music/radio/**)
cp "$EDITOR/music/radio/AntiRepeatBuffer.ts"    src/radio/music/radio/
cp "$EDITOR/music/radio/CompositionScheduler.ts" src/radio/music/radio/
cp "$EDITOR/music/radio/MoodScheduler.ts"        src/radio/music/radio/
cp "$EDITOR/music/radio/MusicalState.ts"         src/radio/music/radio/
cp "$EDITOR/music/radio/RadioComposer.ts"        src/radio/music/radio/
cp "$EDITOR/music/radio/arrangement.ts"          src/radio/music/radio/
cp "$EDITOR/music/radio/banks.ts"                src/radio/music/radio/
cp "$EDITOR/music/radio/fx.ts"                   src/radio/music/radio/
cp "$EDITOR/music/radio/radioConfig.ts"          src/radio/music/radio/
cp "$EDITOR/music/radio/theory.ts"               src/radio/music/radio/
cp "$EDITOR/music/radio/trackStyle.ts"           src/radio/music/radio/
cp "$EDITOR/music/radio/weighted.ts"             src/radio/music/radio/

# Движки (engines/)
cp "$EDITOR/music/radio/engines/ArrangementEngine.ts" src/radio/music/radio/engines/
cp "$EDITOR/music/radio/engines/BassEngine.ts"        src/radio/music/radio/engines/
cp "$EDITOR/music/radio/engines/HarmonyEngine.ts"     src/radio/music/radio/engines/
cp "$EDITOR/music/radio/engines/MelodyEngine.ts"      src/radio/music/radio/engines/
cp "$EDITOR/music/radio/engines/RhythmEngine.ts"      src/radio/music/radio/engines/
cp "$EDITOR/music/radio/engines/TimbreEngine.ts"      src/radio/music/radio/engines/

# Web Audio backend
cp "$EDITOR/music/seededRandom.ts"    src/radio/music/
cp "$EDITOR/music/StrudelWebEngine.ts" src/radio/music/
cp "$EDITOR/music/prelude.ts"         src/radio/music/
cp "$EDITOR/music/IStrudelEngine.ts"  src/radio/music/
cp "$EDITOR/music/stemContract.ts"    src/radio/music/
cp "$EDITOR/music/wavEncoder.ts"      src/radio/music/
cp "$EDITOR/music/strudel-web.d.ts"   src/radio/music/

# Контроллер и загрузчик банков
cp "$EDITOR/app/radio/RadioController.ts" src/radio/app/
cp "$EDITOR/app/radio/radioBanks.ts"      src/radio/app/
```

- [ ] **Шаг 4: Скопировать JSON-банки**

```bash
EDITOR_PUB="C:/Users/Home/PycharmProjects/oneshot_music_editor/public/data/radio"
cp "$EDITOR_PUB/moods.json"        public/radio/
cp "$EDITOR_PUB/progressions.json" public/radio/
cp "$EDITOR_PUB/drums.json"        public/radio/
cp "$EDITOR_PUB/instruments.json"  public/radio/
cp "$EDITOR_PUB/scales.json"       public/radio/
```

- [ ] **Шаг 5: Исправить импорты в скопированных файлах**

В `src/radio/app/RadioController.ts` заменить `'../../music/radio/` → `'../music/radio/`:
```bash
sed -i "s|'../../music/radio/|'../music/radio/|g" src/radio/app/RadioController.ts
```

В `src/radio/app/radioBanks.ts` заменить `'../../music/radio/` → `'../music/radio/`:
```bash
sed -i "s|'../../music/radio/|'../music/radio/|g" src/radio/app/radioBanks.ts
```

- [ ] **Шаг 6: Создать barrel `src/radio/index.ts`**

```ts
export { StrudelWebEngine } from './music/StrudelWebEngine'
export type { IStrudelEngine } from './music/IStrudelEngine'

export { RadioController, sectionDurationMs } from './app/RadioController'
export type { RadioEngine, RadioControllerDeps } from './app/RadioController'

export { loadRadioBanks } from './app/radioBanks'
export type { FetchLike } from './app/radioBanks'
export { validateBanks } from './music/radio/banks'
export type { RadioBanks } from './music/radio/banks'

export { DEFAULT_RADIO_CONFIG, loadRadioConfig } from './music/radio/radioConfig'
export type { RadioConfig } from './music/radio/radioConfig'

export type { MusicalState } from './music/radio/MusicalState'
```

- [ ] **Шаг 7: Проверить типы**

```bash
npx tsc -b --noEmit
```

Ожидание: **0 ошибок**. Если есть — исправить импорты.

- [ ] **Шаг 8: Коммит**

```bash
git add src/radio/ public/radio/ package.json package-lock.json
git commit -m "feat(radio): copy generative radio engine from oneshot_music_editor"
```

---

## Задача 2: `radioTrackName` + юнит-тест

**Файлы:**
- Создать: `src/radio/trackName.ts`
- Создать: `tests/unit/radioTrackName.test.ts`

**Интерфейсы:**
- Потребляет: `MusicalState` из `src/radio/music/radio/MusicalState`
- Производит:
  ```ts
  export function radioTrackName(state: MusicalState): string
  // Возвращает строку вида "dark_techno_124bpm_3f2a"
  ```

- [ ] **Шаг 1: Написать тест**

`tests/unit/radioTrackName.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { radioTrackName } from '../../src/radio/trackName'
import type { MusicalState } from '../../src/radio/music/radio/MusicalState'

const BASE: MusicalState = {
  seed: 'abc', trackIndex: 0, trackSeed: 'abc:t0', strudelCode: '',
  mood: 'dark_techno', sectionsUntilMoodChange: 8,
  key: 'E', scaleName: 'phrygian', chord: 'Em7',
  section: 'drop', sectionBars: 8, bpm: 124, bar: 0,
  layers: { kicks: true, bass: true, lead: false, bg: false, perc: false },
}

describe('radioTrackName', () => {
  it('форматирует строку mood_bpmbpm_xxxx', () => {
    expect(radioTrackName(BASE)).toMatch(/^dark_techno_124bpm_[0-9a-f]{4}$/)
  })

  it('разные trackSeed дают разные суффиксы', () => {
    const a = radioTrackName(BASE)
    const b = radioTrackName({ ...BASE, trackSeed: 'abc:t1', trackIndex: 1 })
    expect(a).not.toBe(b)
  })

  it('mood из состояния используется как префикс', () => {
    expect(radioTrackName({ ...BASE, mood: 'dub_techno', bpm: 118 }))
      .toMatch(/^dub_techno_118bpm_/)
  })
})
```

- [ ] **Шаг 2: Запустить тест — убедиться, что он падает**

```bash
npx vitest run --config vitest.config.ts tests/unit/radioTrackName.test.ts
```

Ожидание: **FAIL** — `radioTrackName` не определена.

- [ ] **Шаг 3: Реализовать `src/radio/trackName.ts`**

```ts
import type { MusicalState } from './music/radio/MusicalState'

function djb2hex(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(16).slice(-4)
}

export function radioTrackName(state: MusicalState): string {
  return `${state.mood}_${state.bpm}bpm_${djb2hex(state.trackSeed)}`
}
```

- [ ] **Шаг 4: Запустить тест — убедиться, что проходит**

```bash
npx vitest run --config vitest.config.ts tests/unit/radioTrackName.test.ts
```

Ожидание: **PASS** (3 теста).

- [ ] **Шаг 5: Коммит**

```bash
git add src/radio/trackName.ts tests/unit/radioTrackName.test.ts
git commit -m "feat(radio): add radioTrackName utility"
```

---

## Задача 3: Расширить settings.ts + тест

**Файлы:**
- Изменить: `src/settings.ts`
- Изменить: `tests/unit/settings.test.ts` (или создать, если его нет)

**Интерфейсы:**
- Производит поля в `PlayerProfile`:
  ```ts
  radioEnabled: boolean   // false по умолчанию
  volumeRadio: number     // 0.8 по умолчанию
  ```

- [ ] **Шаг 1: Проверить, есть ли тест для settings**

```bash
ls tests/unit/settings.test.ts 2>/dev/null || echo "нет"
```

- [ ] **Шаг 2: Написать/добавить тест для новых полей**

Если файл существует — добавить в него. Если нет — создать `tests/unit/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadProfile, saveProfile } from '../../src/settings'

describe('settings: radioEnabled / volumeRadio', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('новый профиль имеет radioEnabled=false и volumeRadio=0.8', () => {
    const p = loadProfile()
    expect(p.radioEnabled).toBe(false)
    expect(p.volumeRadio).toBeCloseTo(0.8)
  })

  it('сохранённые значения восстанавливаются', () => {
    const p = loadProfile()
    saveProfile({ ...p, radioEnabled: true, volumeRadio: 0.5 })
    const p2 = loadProfile()
    expect(p2.radioEnabled).toBe(true)
    expect(p2.volumeRadio).toBeCloseTo(0.5)
  })

  it('мусорные значения заменяются на дефолт', () => {
    const p = loadProfile()
    saveProfile({ ...p, radioEnabled: 'yes' as never, volumeRadio: 999 })
    const p2 = loadProfile()
    expect(p2.radioEnabled).toBe(false)
    expect(p2.volumeRadio).toBeCloseTo(0.8)
  })
})
```

- [ ] **Шаг 3: Запустить тест — убедиться, что падает**

```bash
npx vitest run --config vitest.config.ts tests/unit/settings.test.ts
```

Ожидание: **FAIL** — поля не определены.

- [ ] **Шаг 4: Добавить поля в `src/settings.ts`**

Добавить в интерфейс `PlayerProfile` (после `volumeMenuMusic`):
```ts
volumeRadio: number       // audio: radio volume 0..1; local preference
radioEnabled: boolean     // audio: generative radio mode on/off; local preference
```

Добавить константу (рядом с `VOL_DEFAULT`):
```ts
const VOL_RADIO_DEFAULT = 0.8
```

В функцию `randomProfile()` добавить в объект возврата:
```ts
volumeRadio: VOL_RADIO_DEFAULT,
radioEnabled: false,
```

В функцию `sanitize()` добавить перед `return`:
```ts
const volumeRadio = clampVolume(p.volumeRadio, VOL_RADIO_DEFAULT)
const radioEnabled = typeof p.radioEnabled === 'boolean' ? p.radioEnabled : false
```

И добавить в возвращаемый объект `sanitize`:
```ts
volumeRadio, radioEnabled,
```

- [ ] **Шаг 5: Запустить тест — убедиться, что проходит**

```bash
npx vitest run --config vitest.config.ts tests/unit/settings.test.ts
```

Ожидание: **PASS**.

- [ ] **Шаг 6: Проверить типы**

```bash
npx tsc -b --noEmit
```

Ожидание: **0 ошибок** (TypeScript потребует обновить все места, где собирается объект `PlayerProfile` — скорее всего только `randomProfile` и `sanitize`, уже обновлены).

- [ ] **Шаг 7: Коммит**

```bash
git add src/settings.ts tests/unit/settings.test.ts
git commit -m "feat(radio): add radioEnabled and volumeRadio to PlayerProfile"
```

---

## Задача 4: `RadioMiniPlayer` + прогрев в App

**Файлы:**
- Создать: `src/components/RadioMiniPlayer.tsx`
- Изменить: `src/App.tsx` (радио-стейт + прогрев + рендер мини-плеера)

**Интерфейсы:**
- Потребляет: `RadioController`, `MusicalState` (задача 1), `radioTrackName` (задача 2), `PlayerProfile.radioEnabled/volumeRadio` (задача 3)
- Производит:
  ```ts
  // Props RadioMiniPlayer
  interface RadioMiniPlayerProps {
    initState: 'idle' | 'loading' | 'ready' | 'error'
    enabled: boolean
    musicalState: MusicalState | null
    onEnable: () => void     // вызвать из gesture-handler'а
    onDisable: () => void
    onOpenScreen: () => void // навигация на экран Radio
  }
  ```

- [ ] **Шаг 1: Добавить радио-стейт в `src/App.tsx`**

Добавить `import type` в начало файла (стирается runtime'ом — в lazy chunk не попадёт):
```ts
import type { RadioController, MusicalState as RadioMusicalState } from './radio/index'
```

После существующего `const [sfx] = useState(...)` добавить:

```ts
type RadioInitState = 'idle' | 'loading' | 'ready' | 'error'

// Радио-движок (lazy, создаётся при первом прогреве)
const radioControllerRef = useRef<RadioController | null>(null)
const [radioInitState, setRadioInitState] = useState<RadioInitState>('idle')
const [radioMusicalState, setRadioMusicalState] = useState<RadioMusicalState | null>(null)
```

- [ ] **Шаг 2: Добавить функцию прогрева в `src/App.tsx`**

После стейтов добавить:

```ts
const radioWarmupRef = useRef(false)

const warmupRadio = useCallback(async () => {
  if (radioWarmupRef.current) return
  radioWarmupRef.current = true
  setRadioInitState('loading')
  try {
    const { StrudelWebEngine, RadioController, loadRadioBanks, DEFAULT_RADIO_CONFIG } =
      await import('./radio/index')
    const banks = await loadRadioBanks(fetch, '/radio/')
    const engine = new StrudelWebEngine()
    const controller = new RadioController({
      engine,
      banks,
      config: DEFAULT_RADIO_CONFIG,
      volume: profile.volumeMaster * profile.volumeRadio,
      onState: s => setRadioMusicalState(s),
    })
    radioControllerRef.current = controller
    setRadioInitState('ready')
  } catch (e) {
    console.error('[Radio] warmup failed:', e)
    setRadioInitState('error')
    radioWarmupRef.current = false   // разрешить повторную попытку
  }
}, [profile.volumeMaster, profile.volumeRadio])
```

- [ ] **Шаг 3: Добавить обработчики включения/выключения в `src/App.tsx`**

```ts
const handleRadioEnable = useCallback(() => {
  const controller = radioControllerRef.current
  if (!controller || radioInitState !== 'ready') return
  menuMusic.stop()
  controller.setVolume(profile.volumeMaster * profile.volumeRadio)
  void controller.start()   // ОБЯЗАТЕЛЬНО из gesture-handler'а (AudioContext.resume)
  setProfile(p => { const n = { ...p, radioEnabled: true }; saveProfile(n); return n })
}, [radioInitState, menuMusic, profile.volumeMaster, profile.volumeRadio])

const handleRadioDisable = useCallback(() => {
  radioControllerRef.current?.stop()
  void menuMusic.start()   // AudioContext уже разблокирован — жест не нужен
  setProfile(p => { const n = { ...p, radioEnabled: false }; saveProfile(n); return n })
}, [menuMusic])
```

- [ ] **Шаг 4: Создать `src/components/RadioMiniPlayer.tsx`**

```tsx
import type { MusicalState } from '../radio/music/radio/MusicalState'
import { radioTrackName } from '../radio/trackName'

export type RadioInitState = 'idle' | 'loading' | 'ready' | 'error'

interface RadioMiniPlayerProps {
  initState: RadioInitState
  enabled: boolean
  musicalState: MusicalState | null
  onEnable: () => void
  onDisable: () => void
  onOpenScreen: () => void
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: '2.5rem',
  right: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.4rem 0.75rem',
  borderRadius: '14px',
  background: 'rgba(10, 15, 20, 0.55)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 40px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.06)',
  fontFamily: 'var(--ui-font)',
  fontSize: '0.65rem',
  letterSpacing: '0.12em',
  userSelect: 'none',
  zIndex: 10,
}

const LABEL_INACTIVE = 'rgba(255,255,255,0.45)'
const LABEL_ACTIVE = 'var(--accent)'

export function RadioMiniPlayer({ initState, enabled, musicalState, onEnable, onDisable, onOpenScreen }: RadioMiniPlayerProps) {
  const isReady = initState === 'ready'
  const label = initState === 'loading' ? 'RADIO ···'
    : initState === 'error' ? 'RADIO ✕'
    : enabled ? '■ RADIO'
    : 'RADIO'

  return (
    <div style={PANEL_STYLE}>
      <button
        onClick={enabled ? onDisable : onEnable}
        disabled={!isReady}
        style={{
          background: 'none', border: 'none', cursor: isReady ? 'pointer' : 'default',
          color: enabled ? LABEL_ACTIVE : LABEL_INACTIVE,
          fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit',
          padding: 0,
        }}
      >
        {label}
      </button>
      {enabled && musicalState && (
        <button
          onClick={onOpenScreen}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit',
            padding: 0,
          }}
        >
          {radioTrackName(musicalState)}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Шаг 5: Встроить `RadioMiniPlayer` и прогрев в `src/App.tsx`**

Добавить `useEffect` для прогрева при первом появлении меню:

```ts
// Прогрев радио при первом рендере меню (не game/trailer/editor)
const radioScreenVisible = screen !== 'game' && screen !== 'trailer' && !editorMode
useEffect(() => {
  if (radioScreenVisible) void warmupRadio()
}, [radioScreenVisible, warmupRadio])
```

Добавить `useEffect` для автостарта радио при загрузке (если `radioEnabled=true` в сохранённом профиле):
```ts
// Когда прогрев завершился и радио было включено в прошлой сессии — стартуем при жесте
useEffect(() => {
  if (radioInitState !== 'ready' || !profile.radioEnabled) return
  const controller = radioControllerRef.current
  if (!controller) return
  if (gesturedRef.current) {
    // Уже был жест (desktop autoplay или уже кликал) — стартуем сразу
    menuMusic.stop()
    controller.setVolume(profile.volumeMaster * profile.volumeRadio)
    void controller.start()
    return
  }
  const onGesture = () => {
    gesturedRef.current = true
    menuMusic.stop()
    controller.setVolume(profile.volumeMaster * profile.volumeRadio)
    void controller.start()
    window.removeEventListener('pointerdown', onGesture)
    window.removeEventListener('keydown', onGesture)
  }
  window.addEventListener('pointerdown', onGesture)
  window.addEventListener('keydown', onGesture)
  return () => {
    window.removeEventListener('pointerdown', onGesture)
    window.removeEventListener('keydown', onGesture)
  }
}, [radioInitState, profile.radioEnabled, menuMusic, profile.volumeMaster, profile.volumeRadio])
```

В рендере App, после `{screen !== 'game' && screen !== 'trailer' && <VersionChip />}` добавить:

```tsx
{screen !== 'game' && screen !== 'trailer' && screen !== 'radio' && (
  <RadioMiniPlayer
    initState={radioInitState}
    enabled={profile.radioEnabled}
    musicalState={radioMusicalState}
    onEnable={handleRadioEnable}
    onDisable={handleRadioDisable}
    onOpenScreen={() => setScreen('radio')}
  />
)}
```

- [ ] **Шаг 6: Проверить типы**

```bash
npx tsc -b --noEmit
```

Ожидание: **0 ошибок**.

- [ ] **Шаг 7: Коммит**

```bash
git add src/components/RadioMiniPlayer.tsx src/App.tsx
git commit -m "feat(radio): add RadioMiniPlayer and App warmup logic"
```

---

## Задача 5: Экран Radio + кнопка в MainMenu

**Файлы:**
- Создать: `src/screens/Radio.tsx`
- Изменить: `src/App.tsx` — добавить `'radio'` в тип `Screen`, роутинг, props в MainMenu
- Изменить: `src/screens/MainMenu.tsx` — кнопка RADIO

**Интерфейсы:**
- Потребляет: `RadioInitState`, `MusicalState`, `radioTrackName`, `onEnable/onDisable`
- Props экрана:
  ```ts
  interface RadioScreenProps {
    initState: RadioInitState
    enabled: boolean
    musicalState: MusicalState | null
    volume: number
    onEnable: () => void
    onDisable: () => void
    onVolumeChange: (v: number) => void
    onBack: () => void
  }
  ```

- [ ] **Шаг 1: Добавить `'radio'` в тип Screen в `src/App.tsx`**

```ts
type Screen = 'menu' | 'lobby' | 'game' | 'settings' | 'appearance' | 'about' | 'trailer' | 'radio'
```

- [ ] **Шаг 2: Создать `src/screens/Radio.tsx`**

```tsx
import { radioTrackName } from '../radio/trackName'
import type { MusicalState } from '../radio/music/radio/MusicalState'
import type { RadioInitState } from '../components/RadioMiniPlayer'
import { Button } from '../ui/Button'
import { Slider } from '../ui/Slider'

interface RadioScreenProps {
  initState: RadioInitState
  enabled: boolean
  musicalState: MusicalState | null
  volume: number
  onEnable: () => void
  onDisable: () => void
  onVolumeChange: (v: number) => void
  onBack: () => void
}

const CARD_STYLE: React.CSSProperties = {
  maxWidth: '480px',
  width: '100%',
  padding: '2rem',
  borderRadius: '14px',
  background: 'rgba(10, 15, 20, 0.55)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 40px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  fontFamily: 'var(--ui-font)',
}

const TRACK_NAME_STYLE: React.CSSProperties = {
  fontSize: '1.25rem',
  letterSpacing: '0.1em',
  color: 'var(--accent)',
  wordBreak: 'break-all',
}

const META_STYLE: React.CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.12em',
  color: 'rgba(255,255,255,0.5)',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.55rem',
  letterSpacing: '0.2em',
  color: 'rgba(255,255,255,0.3)',
  textTransform: 'uppercase',
}

export function Radio({ initState, enabled, musicalState, volume, onEnable, onDisable, onVolumeChange, onBack }: RadioScreenProps) {
  const isReady = initState === 'ready'
  const trackName = musicalState ? radioTrackName(musicalState) : '···'
  const meta = musicalState
    ? `${musicalState.bpm} BPM  ·  ${musicalState.key} ${musicalState.scaleName}  ·  ${musicalState.section}`
    : ''

  return (
    <div className="panel-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={CARD_STYLE}>
        <span style={LABEL_STYLE}>RADIO</span>
        <div style={TRACK_NAME_STYLE}>{trackName}</div>
        {meta && <div style={META_STYLE}>{meta}</div>}
        {initState === 'loading' && <div style={META_STYLE}>initializing…</div>}
        {initState === 'error'   && <div style={{ ...META_STYLE, color: 'rgba(255,80,80,0.7)' }}>error — check connection</div>}
        <Button
          variant="primary"
          disabled={!isReady}
          onClick={enabled ? onDisable : onEnable}
        >
          {enabled ? '■ STOP' : '▶ START'}
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={META_STYLE}>VOL</span>
          <Slider min={0} max={1} step={0.01} value={volume} onChange={onVolumeChange} style={{ flex: 1 }} />
          <span style={META_STYLE}>{Math.round(volume * 100)}</span>
        </div>
        <Button variant="ghost" onClick={onBack}>← BACK</Button>
      </div>
    </div>
  )
}
```

- [ ] **Шаг 3: Добавить роутинг и props в `src/App.tsx`**

В рендере App внутри блока `{screen !== 'game' && screen !== 'trailer' && (...)}` добавить:

```tsx
{screen === 'radio' && (
  <Radio
    initState={radioInitState}
    enabled={profile.radioEnabled}
    musicalState={radioMusicalState}
    volume={profile.volumeRadio}
    onEnable={handleRadioEnable}
    onDisable={handleRadioDisable}
    onVolumeChange={v => {
      radioControllerRef.current?.setVolume(profile.volumeMaster * v)
      setProfile(p => { const n = { ...p, volumeRadio: v }; saveProfile(n); return n })
    }}
    onBack={() => setScreen('menu')}
  />
)}
```

Импорт добавить в начало файла:
```ts
import { Radio } from './screens/Radio'
import type { RadioInitState } from './components/RadioMiniPlayer'
```

- [ ] **Шаг 4: Добавить кнопку RADIO в `src/screens/MainMenu.tsx`**

Добавить prop `onRadio: () => void` в `MainMenuProps` и добавить кнопку после About:

```tsx
// В интерфейсе:
interface MainMenuProps {
  onPlay: () => void
  onAppearance: () => void
  onSettings: () => void
  onAbout: () => void
  onRadio: () => void
  onExit: () => void
}

// В рендере после кнопки About:
<Button variant="secondary" style={btn} onClick={onRadio} data-testid="menu-radio">RADIO</Button>
```

- [ ] **Шаг 5: Передать `onRadio` из `src/App.tsx`**

В рендере App найти `<MainMenu ...>` и добавить проп:
```tsx
<MainMenu onPlay={handlePlay} onAppearance={handleAppearance} onSettings={handleSettings} onAbout={handleAbout} onRadio={() => setScreen('radio')} onExit={handleExit} />
```

- [ ] **Шаг 6: Проверить типы**

```bash
npx tsc -b --noEmit
```

Ожидание: **0 ошибок**.

- [ ] **Шаг 7: Коммит**

```bash
git add src/screens/Radio.tsx src/screens/MainMenu.tsx src/App.tsx
git commit -m "feat(radio): add Radio screen and MainMenu button"
```

---

## Задача 6: Game.tsx — radioActive prop + NOOP engine

**Файлы:**
- Изменить: `src/Game.tsx`
- Изменить: `src/App.tsx` (передача `radioActive` в `GameCanvas`)

**Контекст:** `Match` получает `musicEngine` в конструкторе и запускает музыку внутри. Когда радио активно — передаём `NOOP_MUSIC_ENGINE`, который удовлетворяет `IMusicEngine` но ничего не делает. `Match` об этом не знает.

**Интерфейсы:**
- Потребляет: `IMusicEngine` из `src/game/audio/types`
- Производит: добавляет `radioActive?: boolean` в `GameProps` и `GameCanvasProps`

- [ ] **Шаг 1: Добавить NOOP engine и `radioActive` в `src/Game.tsx`**

После импортов добавить:

```ts
import type { IMusicEngine } from './game/audio/types'

const NOOP_MUSIC_ENGINE: IMusicEngine = {
  load: () => Promise.resolve(),
  start: () => Promise.resolve(),
  fadeOut: () => {},
  stop: () => {},
  setMasterGain: () => {},
  dispose: () => {},
  loopIndex: 0,
  activeStemIds: () => [],
  readLevel: () => 0,
  readBands: (_out: Float32Array) => {},
}
```

В `GameProps` добавить (после `audioAnalysis`):
```ts
radioActive?: boolean
```

В `GameImpl` заменить:
```ts
const musicEngine = useMemo(() => new WebAudioMusicEngine(), [])
```
на:
```ts
const radioActiveRef = useRef(radioActive ?? false)
const musicEngine = useMemo(
  () => radioActiveRef.current ? NOOP_MUSIC_ENGINE : new WebAudioMusicEngine(),
  [],
)
```

- [ ] **Шаг 2: Добавить `radioActive` в `GameCanvasProps` и передать в Game**

В интерфейсе `GameCanvasProps` добавить:
```ts
radioActive: boolean
```

В рендере `GameCanvas` передать:
```tsx
<Game ... radioActive={radioActive} />
```

В деструктуризации `GameCanvas` добавить `radioActive`.

- [ ] **Шаг 3: Передать `radioActive` из `src/App.tsx`**

Найти `<GameCanvas ...>` в рендере App и добавить:
```tsx
radioActive={profile.radioEnabled}
```

- [ ] **Шаг 4: Проверить типы**

```bash
npx tsc -b --noEmit
```

Ожидание: **0 ошибок**.

- [ ] **Шаг 5: Коммит**

```bash
git add src/Game.tsx src/App.tsx
git commit -m "feat(radio): pass radioActive to Game, skip MatchMusic via NOOP engine"
```

---

## Задача 7: Settings — слайдер громкости радио

**Файлы:**
- Изменить: `src/screens/Settings.tsx`

**Интерфейсы:**
- Потребляет: `profile.volumeRadio`, `profile.radioEnabled` (задача 3)

- [ ] **Шаг 1: Добавить `settingsVolRadio` в `SoundControls` в `src/components/SettingsControls.tsx`**

Объём громкости для радио живёт рядом с остальными слайдерами. Файл уже правильно структурирован — добавляем слайдер после `volumeMenuMusic`:

```tsx
// В src/components/SettingsControls.tsx, функция SoundControls, после строки:
//   <Slider label={t.settingsVolMenuMusic} value={profile.volumeMenuMusic} onChange={v => set({ volumeMenuMusic: v })} />
// добавить:
<Slider label="Radio" value={profile.volumeRadio} onChange={v => set({ volumeRadio: v })} />
```

Полный блок `SoundControls` после изменения:
```tsx
export function SoundControls({ profile, onChange }: ControlsProps) {
  const t = useT()
  const set = (patch: Partial<PlayerProfile>) => persist(profile, onChange, patch)
  return (
    <>
      <div style={subHeader}>{t.settingsVolumeGroup}</div>
      <Slider label={t.settingsVolMaster}    value={profile.volumeMaster}    onChange={v => set({ volumeMaster: v })} />
      <Slider label={t.settingsVolMusic}     value={profile.volumeMusic}     onChange={v => set({ volumeMusic: v })} />
      <Slider label={t.settingsVolMenuMusic} value={profile.volumeMenuMusic} onChange={v => set({ volumeMenuMusic: v })} />
      <Slider label="Radio"                  value={profile.volumeRadio}     onChange={v => set({ volumeRadio: v })} />
      <Slider label={t.settingsVolSfx}       value={profile.volumeSfx}       onChange={v => set({ volumeSfx: v })} />
    </>
  )
}
```

Метка "Radio" намеренно не локализована — аналогично именам модели-игрока.

- [ ] **Шаг 3: Проверить типы**

```bash
npx tsc -b --noEmit
```

Ожидание: **0 ошибок**.

- [ ] **Шаг 4: Коммит**

```bash
git add src/screens/Settings.tsx
git commit -m "feat(radio): add radio volume slider in Settings"
```

---

## Задача 8: Tauri CSP

**Файлы:**
- Изменить: `src-tauri/tauri.conf.json`

**Зачем:** `StrudelWebEngine` загружает сэмплы с `raw.githubusercontent.com` и `strudel.b-cdn.net`. Без разрешения в CSP Tauri заблокирует запросы на desktop/Steam-сборке.

- [ ] **Шаг 1: Найти текущий CSP в tauri.conf.json**

```bash
grep -n "csp\|CSP\|connect-src\|Content-Security" src-tauri/tauri.conf.json
```

- [ ] **Шаг 2: Добавить CDN-источники в `connect-src`**

Найти в `tauri.conf.json` секцию `security.csp` (или `security`) и добавить/расширить `connect-src`:

```json
"connect-src": "ipc: http://ipc.localhost https://raw.githubusercontent.com https://strudel.b-cdn.net"
```

Если `csp` пока `null` или пустая строка — задать полную политику:

```json
"csp": "default-src 'self'; connect-src ipc: http://ipc.localhost https://raw.githubusercontent.com https://strudel.b-cdn.net; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
```

- [ ] **Шаг 3: Проверить, что tauri.conf.json валидный JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')); console.log('ok')"
```

Ожидание: `ok`.

- [ ] **Шаг 4: Коммит**

```bash
git add src-tauri/tauri.conf.json
git commit -m "fix(tauri): allow Strudel CDN origins in CSP for radio drum samples"
```
