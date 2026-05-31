# Рефакторинг OneShot: OOP/SOLID архитектура

## Контекст

Игра выросла за серию коммитов в монолит: Game.tsx (460 строк) содержит 7+ несвязанных ответственностей, логика луча и рейкастинга дублируется между Game и Bot, App.tsx передаёт 8 отдельных callback-пропов в Canvas. Добавить новое оружие, режим игры или тип бота сейчас означает трогать всё сразу. Цель рефакторинга — SRP на уровне файлов, устранение дублирования, нулевое изменение поведения.

---

## Выявленные проблемы

### 1. SRP-нарушения в Game.tsx (критично)

Один компонент отвечает за:
- физику персонажа (WASD, гравитация, прыжок) — ~30 строк
- систему луча (windup, cooldown, raycast, fire) — ~100 строк
- систему щита (active, duration, cooldown) — ~40 строк
- визуализацию луча (каждый кадр пересчитывает геометрию) — ~30 строк
- частицы (обновление + hack с `forceParticleRender`) — ~25 строк
- camera shake, динамический FOV — ~15 строк
- спектатор-мод — ~20 строк
- HUD обновления каждые 50ms — ~15 строк
- управление 4 ref-таймерами с ручной очисткой — ~30 строк

### 2. Дублирование между Game.tsx и Bot.tsx

| Что дублируется | Game.tsx | Bot.tsx |
|---|---|---|
| Рейкаст (traverse + Raycaster) | строки 120–128 | строки 162–169 |
| Визуализация луча (mid, quat, scale) | строки 300–326 | строки 189–214 |
| Timer ref-паттерн (setTimeout + ref) | 4 таймера | 3 таймера |

### 3. Props drilling в App.tsx

8 callback-пропов в `<Game />` — каждый новый визуальный эффект требует: `useState` + callback + inline `setTimeout` + новый div в JSX.

### 4. Arena.tsx — лишняя обёртка

Arena сейчас просто оборачивает свет + стены + `<Bot />`. Бот — игровая сущность, не часть сцены.

### 5. Нет noRaycast на Arena-мешах

Стены и пол не имеют `userData.noRaycast`, попадают в рейкаст бота. При определённых позициях `blocked = true` даже без геометрии между ботом и игроком (это тот баг с щитом, о котором говорил пользователь — стены при раскладе могут блокировать луч).

---

## Целевая структура

```
src/
├─ constants.ts              # все числовые константы, цвета, тайминги
├─ utils/
│  └─ raycast.ts             # performRaycast(scene, origin, dir, options)
├─ hooks/
│  ├─ useGameInput.ts        ✅ уже хорош
│  ├─ usePlayerMovement.ts   # WASD + гравитация + прыжок + spectator
│  ├─ useBeamWeapon.ts       # windup, fire, cooldown, raycast hit
│  ├─ useShieldSystem.ts     # activate, duration, cooldown — параметризованный
│  ├─ useParticles.ts        # обновление частиц, возвращает массив для рендера
│  ├─ useCameraEffects.ts    # shake, FOV lerp
│  └─ useFlash.ts            # setFlash(true) + auto-reset через duration
├─ components/
│  ├─ Beam3D.tsx             # shared рендер луча (геометрия + fade)
│  ├─ ShieldBrackets.tsx     # 4 угловые SVG-скобки
│  ├─ Crosshair.tsx          # прицел + cooldown ring
│  ├─ ScreenFlashes.tsx      # все screen-overlay вспышки
│  └─ HelpOverlay.tsx        # экран до pointer lock
├─ App.tsx                   # только Canvas + HUD layout
├─ Game.tsx                  # ~120 строк: только оркестрация хуков
├─ Bot.tsx                   # ~150 строк: AI + щит + использует Beam3D
└─ Arena.tsx                 # только свет + пол + стены (без Bot)
```

---

## Детальный план изменений

### Шаг 1: constants.ts
Вынести все `const` из Game.tsx, Bot.tsx, App.tsx:
```ts
export const BEAM_COOLDOWN = 1500
export const BEAM_WINDUP   = 400
export const BEAM_DURATION = 200
export const SHIELD_DURATION   = 800
export const SHIELD_COOLDOWN   = 2000
export const BOT_FIRE_INTERVAL = 2500
export const BOT_WINDUP        = 600
export const BOT_SHIELD_INTERVAL = 5000
export const BOT_SHIELD_DURATION = 1500
export const BASE_COLOR  = '#5af'
export const WHITE_COLOR = '#fff'
// ... движение, физика, FOV
```

### Шаг 2: utils/raycast.ts
Устранить дублирование рейкаста:
```ts
export interface RaycastOptions {
  excludeNames?: string[]       // ['target']
  excludeUserData?: string[]    // ['noRaycast', 'botBeam']
}
export function performRaycast(
  scene: THREE.Scene,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  opts: RaycastOptions = {}
): THREE.Intersection[]
```
Заодно добавить `userData.noRaycast = true` на все Arena-меши (стены, пол) — это закроет потенциальный баг с блокировкой луча бота.

### Шаг 3: hooks/useFlash.ts
Убрать дублирование из App.tsx (3 одинаковых паттерна):
```ts
export function useFlash(duration: number): [boolean, () => void]
// Возвращает [active, trigger]
// trigger() → setActive(true), авто-сброс через duration
```

### Шаг 4: hooks/useShieldSystem.ts
Параметризовать логику щита (используется и у игрока, и у бота):
```ts
interface ShieldConfig {
  duration: number
  cooldown: number
  canActivate?: () => boolean   // pointerLock check у игрока
  onActivate?: () => void
  onDeactivate?: () => void
}
export function useShieldSystem(config: ShieldConfig): {
  active: boolean
  cooldownProgress: number      // 0..1 для HUD
  activate: () => void
  reset: () => void             // при respawn
}
```

### Шаг 5: components/Beam3D.tsx
Убрать дублирование визуализации луча:
```tsx
interface Beam3DProps {
  startRef: RefObject<THREE.Vector3>
  endRef:   RefObject<THREE.Vector3 | null>
  activeRef: RefObject<boolean>
  fireTimeRef: RefObject<number>
  duration?: number
  innerColor?: string
  outerColor?: string
  outerOpacity?: number
}
// Внутри useFrame обновляет position/scale/quaternion группы
```
Game.tsx и Bot.tsx оба используют этот компонент.

### Шаг 6: hooks/useBeamWeapon.ts
Вся логика луча игрока:
```ts
export function useBeamWeapon(scene, camera, options): {
  // state для HUD
  windupProgress: number
  cooldownProgress: number
  // refs для Beam3D
  beamActiveRef, beamEndRef, beamFireTimeRef
  // callbacks
  onFire: (hitResult: HitResult) => void    // инъекция реакции на попадание
}
```

### Шаг 7: hooks/usePlayerMovement.ts
Физика + спектатор:
```ts
export function usePlayerMovement(camera, keys, options): {
  velocityY: MutableRefObject<number>
  onGround: MutableRefObject<boolean>
  isSpectator: boolean
  frozenPos: MutableRefObject<THREE.Vector3>
  toggleSpectator: () => void
  resetOnDeath: (spawnPos: THREE.Vector3) => void
}
```

### Шаг 8: App.tsx — переход на useReducer
Заменить 8 `useState` на один `useReducer`:
```ts
type HUDAction =
  | { type: 'BEAM_FLASH' }
  | { type: 'PLAYER_HIT' }
  | { type: 'SHIELD_BLOCK' }
  | { type: 'BOT_SHIELD_HIT' }
  | { type: 'SET_BEAM_PROGRESS', value: number }
  | { type: 'SET_SHIELD_PROGRESS', value: number }
  | { type: 'SET_WINDUP_PROGRESS', value: number }
  | { type: 'SET_SHIELD_VISIBLE', value: boolean }
```
Количество пропов в `<Game />` сокращается до одного: `onHUDEvent(action: HUDAction)`.

### Шаг 9: Arena.tsx — убрать Bot
Arena рендерит только сцену. Bot монтируется в Game.tsx напрямую.

---

## Что НЕ меняем

- Поведение игры (механики, тайминги)
- Тесты — они E2E и проверяют UI, не внутренности
- useGameInput.ts — уже хорош
- randomArenaPos() — остаётся в Arena.tsx (экспортируется)
- Imperative ref-паттерн для обновлений в useFrame — правильный выбор для Three.js

---

## Порядок выполнения

1. `constants.ts` (нет зависимостей, ломает импорты — делается первым)
2. `utils/raycast.ts` + noRaycast на Arena-мешах (закрывает баг)
3. `useFlash.ts` (изолирован, сразу упрощает App.tsx)
4. `Beam3D.tsx` (устраняет дублирование, ничего не меняет снаружи)
5. `useShieldSystem.ts` (сначала игрок, потом Bot)
6. `useBeamWeapon.ts` + `usePlayerMovement.ts`
7. App.tsx → useReducer
8. Arena.tsx — убрать Bot

---

## Верификация

После каждого шага:
```bash
npx playwright test --reporter=line   # все тесты зелёные
```
Финально — запустить игру и вручную проверить: движение, выстрел, блок, смерть, спектатор.
