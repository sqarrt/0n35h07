# Editor Copy/Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выделение прямоугольного параллелепипеда между двумя ячейками в редакторе карт + копирование/вырезание/удаление/вставка с ghost-превью и поворотом.

**Architecture:** Чистый модуль `src/editor/editorSelection.ts` (функции над `Map<string, Cell>`, без React/THREE, иммутабельно — как `editorStore.ts`); `MapEditor.tsx` держит состояние (selection/clipboard/paste) и хоткеи; `EditorScene.tsx` — визуал (бокс выделения, ghost фрагмента) и маршрутизацию ЛКМ/ПКМ. Спека: `docs/superpowers/specs/2026-07-08-editor-copy-paste-design.md`.

**Tech Stack:** TypeScript 6 (erasableSyntaxOnly: без enum/namespace/parameter properties), React 19, R3F 9, Three.js 0.184, vitest.

## Global Constraints

- Ветка `feature/editor-copy-paste` (уже создана от `release_1.1.0`); коммит после каждой задачи.
- Никаких магических чисел — только именованные константы (локальные в файле).
- vitest/playwright сам НЕ запускать — тесты в конце запускает пользователь. После каждой задачи проверка = `npx tsc -b --noEmit` (и `npm run lint` в финале).
- Координатная модель: ячейка `(x,y,z)`, ключ `cellKey(x,y,z)` = `"x,y,z"`, ребро куба `VOXEL = 0.5`, ячейка `y=0` лежит на полу. `Cell = { t: 'cube'|'wedge'; c: string; d: 0|1|2|3; f: boolean; bb: boolean; tr: boolean; ps: boolean }` (из `src/editor/editorStore.ts:16`).
- Направления клина: `d` меняется шагом `(d+1)&3` при повороте на 90° вокруг Y, соответствующем координатному преобразованию относительных ячеек `(x,z) → (nz−1−z, x)` (мировое `(x,z)→(−z,x)`, поворот на −90°, ровно как `wedgeRotationY` шагает на −90° на единицу `d`).
- Ячейка в границах арены `half=[hx,hz]`: `y ≥ 0`, `x·S ≥ −hx − ε`, `(x+1)·S ≤ hx + ε`, аналогично z (S=VOXEL, ε=1e−6).

---

### Task 1: editorSelection — regionBounds + extractRegion

**Files:**
- Create: `src/editor/editorSelection.ts`
- Test: `tests/unit/editorSelection.test.ts`

**Interfaces:**
- Consumes: `cellKey`, `parseCellKey`, `Cell` из `src/editor/editorStore.ts`; `VOXEL` из `src/constants.ts`.
- Produces:
  - `type Vec3i = [number, number, number]`
  - `interface Fragment { size: Vec3i; cells: Map<string, Cell> }` — координаты относительные от `(0,0,0)` (мин-угол bbox региона), `size` = габариты РЕГИОНА (не непустых ячеек).
  - `regionBounds(a: Vec3i, b: Vec3i): { min: Vec3i; max: Vec3i }`
  - `extractRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i): Fragment`

- [ ] **Step 1: Написать падающий тест**

Создать `tests/unit/editorSelection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cellKey } from '../../src/editor/editorStore'
import type { Cell } from '../../src/editor/editorStore'
import { regionBounds, extractRegion } from '../../src/editor/editorSelection'
import type { Vec3i } from '../../src/editor/editorSelection'

const cube = (over: Partial<Cell> = {}): Cell =>
  ({ t: 'cube', c: '#b89863', d: 0, f: false, bb: true, tr: false, ps: false, ...over })

describe('editorSelection — region & extract', () => {
  it('regionBounds нормализует углы в любом порядке', () => {
    const a: Vec3i = [5, 0, -2], b: Vec3i = [1, 3, 4]
    expect(regionBounds(a, b)).toEqual({ min: [1, 0, -2], max: [5, 3, 4] })
    expect(regionBounds(b, a)).toEqual(regionBounds(a, b))
  })

  it('extractRegion берёт только непустые ячейки, координаты относительные, атрибуты целиком', () => {
    const v = new Map<string, Cell>()
    v.set(cellKey(2, 0, 3), cube({ c: '#4af', tr: true, ps: true, bb: false }))
    v.set(cellKey(4, 1, 5), cube())
    v.set(cellKey(9, 9, 9), cube())          // вне региона
    const frag = extractRegion(v, [2, 0, 3], [4, 1, 5])
    expect(frag.size).toEqual([3, 2, 3])
    expect(frag.cells.size).toBe(2)
    expect(frag.cells.get(cellKey(0, 0, 0))).toEqual(cube({ c: '#4af', tr: true, ps: true, bb: false }))
    expect(frag.cells.get(cellKey(2, 1, 2))).toEqual(cube())
  })

  it('extractRegion одинаков при углах в любом порядке', () => {
    const v = new Map<string, Cell>([[cellKey(1, 1, 1), cube()]])
    const f1 = extractRegion(v, [0, 0, 0], [2, 2, 2])
    const f2 = extractRegion(v, [2, 2, 2], [0, 0, 0])
    expect(f2.size).toEqual(f1.size)
    expect([...f2.cells.entries()]).toEqual([...f1.cells.entries()])
  })
})
```

- [ ] **Step 2: Написать минимальную реализацию**

Создать `src/editor/editorSelection.ts`:

```ts
import { cellKey, parseCellKey } from './editorStore'
import type { Cell } from './editorStore'

/**
 * Selection/clipboard logic for the map editor (no React/THREE): an axis-aligned box of cells
 * between two corner cells, copied into a Fragment with coordinates relative to the box min corner.
 * All functions are pure and return new Maps (same convention as editorStore).
 */

export type Vec3i = [number, number, number]

/** Clipboard fragment: region bbox extents in cells + non-empty cells at coords relative to (0,0,0) = min corner. */
export interface Fragment { size: Vec3i; cells: Map<string, Cell> }

/** Normalized region corners (inputs in any order). */
export function regionBounds(a: Vec3i, b: Vec3i): { min: Vec3i; max: Vec3i } {
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  }
}

const inRegion = (x: number, y: number, z: number, min: Vec3i, max: Vec3i) =>
  x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]

/** Copy the non-empty cells of the region into a Fragment (cells keep their Cell objects — Cell is immutable by convention). */
export function extractRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i): Fragment {
  const { min, max } = regionBounds(a, b)
  const cells = new Map<string, Cell>()
  for (const [k, cell] of voxels) {
    const [x, y, z] = parseCellKey(k)
    if (inRegion(x, y, z, min, max)) cells.set(cellKey(x - min[0], y - min[1], z - min[2]), cell)
  }
  return { size: [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1], cells }
}
```

(`VOXEL` здесь не нужен — его импорт добавится в Task 3 вместе с `canStamp`.)

- [ ] **Step 3: Проверка типов**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/editor/editorSelection.ts tests/unit/editorSelection.test.ts
git commit -m "feat(editor): editorSelection — регион между углами и извлечение фрагмента"
```

---

### Task 2: editorSelection — rotateFragment

**Files:**
- Modify: `src/editor/editorSelection.ts`
- Test: `tests/unit/editorSelection.test.ts`

**Interfaces:**
- Produces: `rotateFragment(frag: Fragment): Fragment` — поворот на 90° вокруг вертикали: относительные `(x,y,z) → (nz−1−z, y, x)`, `size [nx,ny,nz] → [nz,ny,nx]`, у клиньев `d' = (d+1)&3`, `f` не меняется.

- [ ] **Step 1: Написать падающий тест**

Добавить в `tests/unit/editorSelection.test.ts` (импортировать `rotateFragment` и тип `Dir` из editorStore):

```ts
const wedge = (d: 0 | 1 | 2 | 3, f = false): Cell =>
  ({ t: 'wedge', c: '#b89863', d, f, bb: true, tr: false, ps: false })

describe('editorSelection — rotate', () => {
  it('поворот меняет габариты местами и переносит ячейку по (x,z)→(nz−1−z,x)', () => {
    // фрагмент 2×1×1: куб в (1,0,0)
    const frag = { size: [2, 1, 1] as Vec3i, cells: new Map([[cellKey(1, 0, 0), cube()]]) }
    const r = rotateFragment(frag)
    expect(r.size).toEqual([1, 1, 2])
    expect(r.cells.get(cellKey(0, 0, 1))).toEqual(cube())
    expect(r.cells.size).toBe(1)
  })

  it('клин: d шагает на +1 по модулю 4, flip не меняется', () => {
    const frag = { size: [1, 1, 1] as Vec3i, cells: new Map([[cellKey(0, 0, 0), wedge(3, true)]]) }
    expect(rotateFragment(frag).cells.get(cellKey(0, 0, 0))).toEqual(wedge(0, true))
  })

  it('4 поворота = identity (кубы и клинья)', () => {
    const frag = {
      size: [3, 2, 1] as Vec3i,
      cells: new Map([
        [cellKey(0, 0, 0), cube({ c: '#f66' })],
        [cellKey(2, 1, 0), wedge(1)],
      ]),
    }
    let r = frag
    for (let i = 0; i < 4; i++) r = rotateFragment(r)
    expect(r.size).toEqual(frag.size)
    expect([...r.cells.entries()].sort()).toEqual([...frag.cells.entries()].sort())
  })
})
```

- [ ] **Step 2: Написать реализацию**

Добавить в `src/editor/editorSelection.ts` (импорт типа `Dir` из `./editorStore`):

```ts
/** 90° rotation about the vertical axis: relative (x,z) → (nz−1−z, x) — the same −90° world turn that
 *  one `d` step encodes (wedgeRotationY = −d·90°), so wedges stay consistent with their cells: d' = (d+1)&3. */
export function rotateFragment(frag: Fragment): Fragment {
  const [nx, ny, nz] = frag.size
  const cells = new Map<string, Cell>()
  for (const [k, cell] of frag.cells) {
    const [x, y, z] = parseCellKey(k)
    const next: Cell = cell.t === 'wedge' ? { ...cell, d: ((cell.d + 1) & 3) as Dir } : cell
    cells.set(cellKey(nz - 1 - z, y, x), next)
  }
  return { size: [nz, ny, nx], cells }
}
```

- [ ] **Step 3: Проверка типов**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/editor/editorSelection.ts tests/unit/editorSelection.test.ts
git commit -m "feat(editor): rotateFragment — поворот фрагмента на 90° с пересчётом клиньев"
```

---

### Task 3: editorSelection — canStamp / stampFragment / eraseRegion

**Files:**
- Modify: `src/editor/editorSelection.ts`
- Test: `tests/unit/editorSelection.test.ts`

**Interfaces:**
- Produces:
  - `canStamp(voxels: Map<string, Cell>, frag: Fragment, anchor: Vec3i, half: [number, number]): boolean` — false при пересечении хотя бы одной непустой ячейки фрагмента с существующим вокселем ИЛИ выходе за границы арены (см. Global Constraints).
  - `stampFragment(voxels: Map<string, Cell>, frag: Fragment, anchor: Vec3i): Map<string, Cell>` — новая Map с добавленными ячейками (anchor = мировая ячейка, куда встаёт мин-угол фрагмента).
  - `eraseRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i): Map<string, Cell>` — новая Map без ячеек региона.

- [ ] **Step 1: Написать падающий тест**

Добавить в `tests/unit/editorSelection.test.ts` (импортировать `canStamp`, `stampFragment`, `eraseRegion`, `extractRegion`):

```ts
describe('editorSelection — stamp & erase', () => {
  const HALF: [number, number] = [4, 4]   // ячейки x,z ∈ [−8, 7] при VOXEL=0.5
  const frag2 = () => ({
    size: [2, 1, 1] as Vec3i,
    cells: new Map([[cellKey(0, 0, 0), cube()], [cellKey(1, 0, 0), cube({ c: '#f66' })]]),
  })

  it('canStamp: свободное место в границах — true', () => {
    expect(canStamp(new Map(), frag2(), [0, 0, 0], HALF)).toBe(true)
    expect(canStamp(new Map(), frag2(), [-8, 0, -8], HALF)).toBe(true)   // впритык к углу
    expect(canStamp(new Map(), frag2(), [6, 0, 7], HALF)).toBe(true)     // x: 6..7 — влезает
  })

  it('canStamp: пересечение хотя бы одной ячейки — false', () => {
    const v = new Map<string, Cell>([[cellKey(1, 0, 0), cube()]])
    expect(canStamp(v, frag2(), [0, 0, 0], HALF)).toBe(false)
    expect(canStamp(v, frag2(), [2, 0, 0], HALF)).toBe(true)   // рядом — свободно
  })

  it('canStamp: выход за границы — false', () => {
    expect(canStamp(new Map(), frag2(), [7, 0, 0], HALF)).toBe(false)    // x: 7..8 — за стену
    expect(canStamp(new Map(), frag2(), [-9, 0, 0], HALF)).toBe(false)
    expect(canStamp(new Map(), frag2(), [0, -1, 0], HALF)).toBe(false)   // под пол
    expect(canStamp(new Map(), frag2(), [0, 0, 8], HALF)).toBe(false)
  })

  it('stampFragment ставит по якорю, исходная Map не мутируется', () => {
    const v = new Map<string, Cell>()
    const out = stampFragment(v, frag2(), [3, 2, -1])
    expect(v.size).toBe(0)
    expect(out.get(cellKey(3, 2, -1))).toEqual(cube())
    expect(out.get(cellKey(4, 2, -1))).toEqual(cube({ c: '#f66' }))
  })

  it('eraseRegion чистит только регион', () => {
    const v = new Map<string, Cell>([
      [cellKey(0, 0, 0), cube()],
      [cellKey(1, 0, 0), cube()],
      [cellKey(5, 0, 0), cube()],
    ])
    const out = eraseRegion(v, [0, 0, 0], [1, 0, 0])
    expect(out.size).toBe(1)
    expect(out.has(cellKey(5, 0, 0))).toBe(true)
    expect(v.size).toBe(3)
  })

  it('cut-сценарий: extract + erase, stamp в другом месте — содержимое совпадает', () => {
    const v = new Map<string, Cell>([[cellKey(2, 0, 2), cube()], [cellKey(3, 1, 2), wedge(2)]])
    const frag = extractRegion(v, [2, 0, 2], [3, 1, 2])
    const cutv = eraseRegion(v, [2, 0, 2], [3, 1, 2])
    const out = stampFragment(cutv, frag, [-5, 0, -5])
    expect([...extractRegion(out, [-5, 0, -5], [-4, 1, -5]).cells.entries()].sort())
      .toEqual([...frag.cells.entries()].sort())
  })
})
```

- [ ] **Step 2: Написать реализацию**

Добавить в `src/editor/editorSelection.ts` (импортировать `VOXEL` из `./editorStore`, если ещё не):

```ts
const BOUNDS_EPS = 1e-6

/** Cell (x,·,z) lies inside the arena floor [−hx,hx]×[−hz,hz]. */
const cellInArena = (x: number, z: number, half: [number, number]) =>
  x * VOXEL >= -half[0] - BOUNDS_EPS && (x + 1) * VOXEL <= half[0] + BOUNDS_EPS &&
  z * VOXEL >= -half[1] - BOUNDS_EPS && (z + 1) * VOXEL <= half[1] + BOUNDS_EPS

/** Paste validity: every fragment cell must land on a free cell inside the arena (and not below the floor). */
export function canStamp(voxels: Map<string, Cell>, frag: Fragment, anchor: Vec3i, half: [number, number]): boolean {
  for (const k of frag.cells.keys()) {
    const [x, y, z] = parseCellKey(k)
    const wx = anchor[0] + x, wy = anchor[1] + y, wz = anchor[2] + z
    if (wy < 0 || !cellInArena(wx, wz, half) || voxels.has(cellKey(wx, wy, wz))) return false
  }
  return true
}

/** Stamp the fragment with its min corner at `anchor`. Returns a new Map. */
export function stampFragment(voxels: Map<string, Cell>, frag: Fragment, anchor: Vec3i): Map<string, Cell> {
  const next = new Map(voxels)
  for (const [k, cell] of frag.cells) {
    const [x, y, z] = parseCellKey(k)
    next.set(cellKey(anchor[0] + x, anchor[1] + y, anchor[2] + z), cell)
  }
  return next
}

/** Remove every cell inside the region. Returns a new Map. */
export function eraseRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i): Map<string, Cell> {
  const { min, max } = regionBounds(a, b)
  const next = new Map(voxels)
  for (const k of voxels.keys()) {
    const [x, y, z] = parseCellKey(k)
    if (inRegion(x, y, z, min, max)) next.delete(k)
  }
  return next
}
```

- [ ] **Step 3: Проверка типов**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/editor/editorSelection.ts tests/unit/editorSelection.test.ts
git commit -m "feat(editor): canStamp/stampFragment/eraseRegion — вставка с валидацией и стирание региона"
```

---

### Task 4: инструмент SELECT + выделение (состояние, углы, визуал)

**Files:**
- Modify: `src/editor/EditorScene.tsx`
- Modify: `src/editor/MapEditor.tsx`

**Interfaces:**
- Consumes: `regionBounds` из Task 1.
- Produces (нужно Task 5/6):
  - `EditorTool` расширен значением `'select'` (`EditorScene.tsx`).
  - Состояние в `MapEditor`: `selection: { a: CellCoord; b?: CellCoord } | null` (`CellCoord = [number,number,number]` — уже объявлен в обоих файлах).
  - Пропсы `EditorScene`: `selection`, `onCorner(cell: CellCoord)`, `onSelectionClear()`.
  - Хелпер в `EditorScene`: `cornerOf(c) = voxels.has(cellKey(...c.remove)) ? c.remove : c.place` — угол по блоку под прицелом, иначе по ячейке установки.

- [ ] **Step 1: EditorScene — тип, пропсы, константы**

В `src/editor/EditorScene.tsx`:

1. Расширить тип (строка ~31):

```ts
export type EditorTool = BlockType | 'spawn0' | 'spawn1' | 'select'
```

2. Импортировать из `./editorStore` дополнительно `cellKey`; добавить импорт:

```ts
import { regionBounds } from './editorSelection'
```

3. Константы рядом с существующими (`REACH` и т.п.):

```ts
const SELECT_BOX_OPACITY = 0.18   // полупрозрачный бокс выделения
const GHOST_COLOR = '#4af'
```

4. В `interface Props` добавить:

```ts
  selection: { a: CellCoord; b?: CellCoord } | null   // выделение: угол 1 (+ угол 2, когда зафиксирован)
  onCorner: (cell: CellCoord) => void
  onSelectionClear: () => void
```

и в деструктуризацию в `EditorScene(props)` — `selection, onCorner, onSelectionClear`.

- [ ] **Step 2: EditorScene — маршрутизация кликов и клавиша B**

1. Хелпер после `pick()` (внутри компонента):

```ts
  // Угол выделения под прицелом: существующий блок — его ячейка, иначе ячейка установки (пол/стена).
  const cornerOf = (c: { place: CellCoord; remove: CellCoord }): CellCoord =>
    voxels.has(cellKey(...c.remove)) ? c.remove : c.place
```

2. В `act(button)` перед существующей логикой:

```ts
      if (tool === 'select') {
        if (button === 0) onCorner(cornerOf(c))
        else if (button === 2) onSelectionClear()
        return
      }
```

3. В `onMouseDown` авто-повтор не включать для select:

```ts
      if (held[e.button] == null && tool !== 'select') held[e.button] = setInterval(() => act(e.button), AUTOCLICK_MS)
```

4. В `onKey` (движение, `switch (e.code)`) добавить case — угол хоткеем из любого инструмента (без авто-повтора зажатия):

```ts
        case 'KeyB': {
          if (down && !e.repeat && document.pointerLockElement) {
            const c = pick()
            if (c) onCorner(cornerOf(c))
          }
          break
        }
```

5. В deps эффекта добавить: `voxels, onCorner, onSelectionClear` (к существующим `tool, color, ...`).

- [ ] **Step 3: EditorScene — живой бокс выделения**

1. Реф рядом с ghost-рефами:

```ts
  const selBoxRef = useRef<THREE.Mesh>(null)
```

2. В `useFrame`, после блока с ghost'ами (там уже есть `const c = pick()` — переиспользовать его):

```ts
    // бокс выделения: от угла 1 до второго угла или ячейки под прицелом (живая растяжка)
    const sb = selBoxRef.current
    if (sb) {
      if (selection) {
        const end = selection.b ?? (c ? cornerOf(c) : selection.a)
        const { min, max } = regionBounds(selection.a, end)
        sb.visible = true
        sb.position.set(
          ((min[0] + max[0] + 1) / 2) * VOXEL,
          ((min[1] + max[1] + 1) / 2) * VOXEL,
          ((min[2] + max[2] + 1) / 2) * VOXEL,
        )
        sb.scale.set((max[0] - min[0] + 1) * VOXEL, (max[1] - min[1] + 1) * VOXEL, (max[2] - min[2] + 1) * VOXEL)
      } else sb.visible = false
    }
```

3. При `tool === 'select'` прятать ghost установки: в ghost-ветке `useFrame` первым условием:

```ts
      if (tool === 'select') { g.visible = false; gw.visible = false; gs.visible = false }
      else if (isSpawnTool(tool)) { ...существующее... }
```

4. JSX рядом с ghost-мешами (без `userData.editorTarget` — не участвует в рейкасте):

```tsx
      {/* Бокс выделения (SELECT): полупрозрачный, виден и изнутри */}
      <mesh ref={selBoxRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={GHOST_COLOR} transparent opacity={SELECT_BOX_OPACITY} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
```

Существующие инлайновые `"#4af"` у ghost-материалов заменить на `{GHOST_COLOR}`.

- [ ] **Step 4: MapEditor — инструмент, состояние, колбэки**

В `src/editor/MapEditor.tsx`:

1. В `TOOLS` добавить пятый инструмент и клавишу:

```ts
const TOOLS: { tool: EditorTool; label: string }[] = [
  { tool: 'cube', label: 'CUBE' },
  { tool: 'wedge', label: 'WEDGE' },
  { tool: 'spawn0', label: 'HOST SPAWN' },
  { tool: 'spawn1', label: 'GUEST SPAWN' },
  { tool: 'select', label: 'SELECT' },
]
const TOOL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']
```

2. Состояние (рядом с `tool`):

```ts
  const [selection, setSelection] = useState<{ a: CellCoord; b?: CellCoord } | null>(null)
```

3. Колбэки (рядом с `onPlace`):

```ts
  // Угол выделения: первый клик — угол 1, второй — угол 2; следующий клик начинает новое выделение.
  const onCorner = useCallback((cell: CellCoord) => {
    setSelection(prev => (!prev || prev.b) ? { a: cell } : { a: prev.a, b: cell })
  }, [])
  const onSelectionClear = useCallback(() => setSelection(null), [])
```

4. Пропсы в `<EditorScene ...>`:

```tsx
          selection={selection}
          onCorner={onCorner} onSelectionClear={onSelectionClear}
```

- [ ] **Step 5: Проверка типов и визуальная проверка**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

Попросить пользователя глянуть в dev-редакторе (`/#editor-<map>`): инструмент 5·SELECT, ЛКМ×2 растягивает и фиксирует бокс, B работает из любого инструмента, ПКМ сбрасывает.

- [ ] **Step 6: Commit**

```bash
git add src/editor/EditorScene.tsx src/editor/MapEditor.tsx
git commit -m "feat(editor): инструмент SELECT — выделение параллелепипеда двумя углами (ЛКМ/B), живой бокс"
```

---

### Task 5: копировать / вырезать / удалить (C / X / Delete)

**Files:**
- Modify: `src/editor/MapEditor.tsx`

**Interfaces:**
- Consumes: `extractRegion`, `eraseRegion` (Task 1/3); `selection` (Task 4).
- Produces: состояние `clipboard: Fragment | null` в `MapEditor` (нужно Task 6).

- [ ] **Step 1: Состояние и хоткеи**

В `src/editor/MapEditor.tsx`:

1. Импорт:

```ts
import { extractRegion, eraseRegion } from './editorSelection'
import type { Fragment } from './editorSelection'
```

2. Состояние:

```ts
  const [clipboard, setClipboard] = useState<Fragment | null>(null)
```

3. Существующий `useEffect` с `onKey` (строки ~109–125) читает только сеттеры и имеет пустые deps — новым веткам нужны значения `voxels`/`selection`. Перестроить эффект: добавить ветки и deps (подписка дешёвая, EditorScene так уже делает). Хоткеи выделения требуют pointer lock (чтобы не срабатывать при вводе в поля панели):

```ts
  useEffect(() => {
    const onLock = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onLock)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab') { e.preventDefault(); setFly(v => !v); return }
      if (e.code === 'KeyR') { setWedgeRot(v => (v + 1) % 4); return }
      if (e.code === 'KeyT') { setWedgeFlip(v => !v); return }
      if (e.code === 'KeyL') { setShowCubeGrid(v => !v); return }
      // операции над зафиксированным выделением — только при захваченной мыши
      if (document.pointerLockElement && selection?.b) {
        const [a, b] = [selection.a, selection.b]
        if (e.code === 'KeyC') { setClipboard(extractRegion(voxels, a, b)); return }
        if (e.code === 'KeyX') { setClipboard(extractRegion(voxels, a, b)); setVoxels(eraseRegion(voxels, a, b)); return }
        if (e.code === 'Delete') { setVoxels(eraseRegion(voxels, a, b)); return }
      }
      const idx = TOOL_KEYS.indexOf(e.code)
      if (idx >= 0) setTool(TOOLS[idx].tool)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerlockchange', onLock)
      window.removeEventListener('keydown', onKey)
    }
  }, [voxels, selection])
```

(Выделение после cut/delete остаётся — блоки исчезают, регион цел.)

- [ ] **Step 2: Проверка типов и визуальная проверка**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

Попросить пользователя проверить: C после выделения (индикации пока нет — проверится в Task 6), X и Delete стирают блоки региона, соседние не трогают.

- [ ] **Step 3: Commit**

```bash
git add src/editor/MapEditor.tsx
git commit -m "feat(editor): C/X/Delete — копирование, вырезание и удаление выделенного региона"
```

---

### Task 6: режим вставки (V, ghost, R-поворот, штамп)

**Files:**
- Modify: `src/editor/MapEditor.tsx`
- Modify: `src/editor/EditorScene.tsx`

**Interfaces:**
- Consumes: `clipboard` (Task 5); `rotateFragment`, `canStamp`, `stampFragment` (Task 2/3).
- Produces: пропсы `EditorScene`: `paste: Fragment | null` (не-null = режим вставки, фрагмент уже повёрнут), `onStamp(anchor: CellCoord)`, `onPasteCancel()`.

- [ ] **Step 1: MapEditor — состояние вставки и хоткеи**

В `src/editor/MapEditor.tsx`:

1. Импорт дополнить: `rotateFragment`, `canStamp`, `stampFragment` из `./editorSelection`.

2. Состояние:

```ts
  const [paste, setPaste] = useState<Fragment | null>(null)   // не-null = режим вставки (фрагмент уже с поворотом)
```

3. В `onKey` из Task 5:
   - ветка `KeyR` первой строкой: `if (e.code === 'KeyR') { if (paste) setPaste(rotateFragment(paste)); else setWedgeRot(v => (v + 1) % 4); return }`
   - блок C/X/Delete обусловить `!paste`: `if (document.pointerLockElement && !paste && selection?.b) { ... }`
   - после него: `if (e.code === 'KeyV' && document.pointerLockElement && !paste && clipboard) { setPaste(clipboard); return }` (повторный V в режиме вставки — no-op, т.к. `!paste`)
   - смена инструмента выключает вставку: `if (idx >= 0) { setTool(TOOLS[idx].tool); setPaste(null) }`
   - deps эффекта: `[voxels, selection, clipboard, paste]`.

4. Кнопки хотбара тоже выключают вставку — в JSX хотбара:

```tsx
          <button key={t} className={`seg${tool === t ? ' seg--on' : ''}`} onClick={() => { setTool(t); setPaste(null) }}>
```

5. Колбэки:

```ts
  // Штамп фрагмента (валидация повторяется на состоянии на момент клика — ghost мог отстать на кадр).
  const onStamp = useCallback((anchor: CellCoord) => {
    if (!paste) return
    setVoxels(prev => canStamp(prev, paste, anchor, half) ? stampFragment(prev, paste, anchor) : prev)
  }, [paste, half])
  const onPasteCancel = useCallback(() => setPaste(null), [])
```

6. Пропсы в `<EditorScene ...>`: `paste={paste} onStamp={onStamp} onPasteCancel={onPasteCancel}`.

7. Хинт-строка (`className="editor-hint"`) — дополнить хвост перед `ESC — menu`:

```
 · 5/B — select · C/X/DEL — copy/cut/delete · V — paste (R rotate)
```

- [ ] **Step 2: EditorScene — ghost фрагмента и маршрутизация**

В `src/editor/EditorScene.tsx`:

1. Импорты дополнить: `canStamp` из `./editorSelection`, тип `Fragment`; из `./editorStore` уже есть `parseCellKey`, `shapeBlock`.

2. Константы:

```ts
const GHOST_INVALID_COLOR = '#f66'   // ghost вставки при пересечении/выходе за арену
const GHOST_OPACITY = 0.35           // как у существующих ghost-материалов
```

(У существующих ghost-мешей `opacity={0.35}` заменить на `{GHOST_OPACITY}`.)

3. `interface Props` + деструктуризация:

```ts
  paste: Fragment | null            // не-null = режим вставки (фрагмент уже повёрнут)
  onStamp: (anchor: CellCoord) => void
  onPasteCancel: () => void
```

4. Ghost-группа фрагмента — общий материал + меши по ячейкам (без `editorTarget` — не рейкастится). Рядом с ghost-рефами:

```ts
  // Ghost вставки: один материал на группу — цвет валидности переключается разом.
  const pasteMat = useMemo(() => new THREE.MeshBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: GHOST_OPACITY, depthWrite: false }), [])
  useEffect(() => () => pasteMat.dispose(), [pasteMat])
  const pasteGroup = useMemo(() => {
    if (!paste) return null
    const grp = new THREE.Group()
    grp.visible = false   // позиционируется в useFrame; без этого мигнёт в начале координат
    const cubes = [...paste.cells].filter(([, cell]) => cell.t === 'cube')
    const boxGeo = new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL)
    const inst = new THREE.InstancedMesh(boxGeo, pasteMat, Math.max(cubes.length, 1))
    inst.count = cubes.length
    const m = new THREE.Matrix4()
    cubes.forEach(([k], i) => {
      const [x, y, z] = parseCellKey(k)
      m.setPosition(...cellCenter(x, y, z))
      inst.setMatrixAt(i, m)
    })
    inst.instanceMatrix.needsUpdate = true
    grp.add(inst)
    for (const [k, cell] of paste.cells) {
      if (cell.t === 'cube') continue
      const [x, y, z] = parseCellKey(k)
      const b = shapeBlock(x, y, z, cell)
      const wm = new THREE.Mesh(cell.f ? wedgeGeoFlip : wedgeGeo, pasteMat)
      wm.position.set(...b.pos)
      wm.rotation.set(0, wedgeRotationY(cell.d), 0)
      wm.scale.set(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
      grp.add(wm)
    }
    return grp
  }, [paste, pasteMat, wedgeGeo, wedgeGeoFlip])
  // Первый ребёнок группы — InstancedMesh кубов с собственной BoxGeometry; wedge-геометрии общие, их не трогать.
  useEffect(() => () => { (pasteGroup?.children[0] as THREE.InstancedMesh | undefined)?.geometry.dispose() }, [pasteGroup])
```

5. В `act(button)` — ветка вставки ПЕРВОЙ (до select):

```ts
      if (paste) {
        if (button === 0) { if (canStamp(voxels, paste, c.place, half)) onStamp(c.place) }
        else if (button === 2) onPasteCancel()
        return
      }
```

Авто-повтор не включать и в режиме вставки:

```ts
      if (held[e.button] == null && tool !== 'select' && !paste) held[e.button] = setInterval(() => act(e.button), AUTOCLICK_MS)
```

`KeyB` в кейсе движения — игнор при вставке: условие уже `if (down && !e.repeat && document.pointerLockElement)` → дополнить `&& !paste`.

Deps эффекта дополнить: `paste, half, onStamp, onPasteCancel`.

6. В `useFrame` — ветка ghost'ов: при вставке прятать обычные ghost'ы и вести группу (вставить ПЕРВОЙ веткой, до `tool === 'select'`):

```ts
      if (paste) {
        g.visible = false; gw.visible = false; gs.visible = false
        if (pasteGroup) {
          pasteGroup.visible = true
          pasteGroup.position.set(c.place[0] * VOXEL, c.place[1] * VOXEL, c.place[2] * VOXEL)
          pasteMat.color.set(canStamp(voxels, paste, c.place, half) ? GHOST_COLOR : GHOST_INVALID_COLOR)
        }
      } else if (tool === 'select') { ... }
```

В else-ветке (`pick()` вернул null) прятать и группу: `if (pasteGroup) pasteGroup.visible = false`.

7. JSX: `{pasteGroup && <primitive object={pasteGroup} />}` рядом с ghost-мешами.

- [ ] **Step 3: Проверка типов и линт**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: без ошибок.

- [ ] **Step 4: Визуальная проверка пользователем**

Попросить пользователя проверить в dev-редакторе:
- выделить блоки (5/B), C, V → ghost фрагмента ходит за прицелом; R вращает (клинья смотрят согласованно с кубами);
- на пересечении с существующими блоками / за стеной ghost красный и ЛКМ не ставит;
- ЛКМ на свободном месте ставит копию и режим вставки остаётся (серия штампов);
- ПКМ / смена инструмента выходят из вставки; X/Delete работают; повторный V в режиме — no-op;
- обычные инструменты (куб/клин/спавны) не сломаны, авто-повтор зажатой ЛКМ на кубах жив.

- [ ] **Step 5: Commit**

```bash
git add src/editor/MapEditor.tsx src/editor/EditorScene.tsx
git commit -m "feat(editor): режим вставки — V, ghost фрагмента с валидацией, R-поворот, серия штампов"
```

---

### Task 7: финал — тесты, changelog, ревью

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Попросить пользователя запустить тесты**

Пользователь запускает `npm run test` (правило проекта: vitest/playwright гоняет он). Ожидаемо: юнит-тесты `editorSelection` зелёные, существующие не сломаны.

- [ ] **Step 2: Обновить CHANGELOG.md**

Добавить запись в раздел текущего релиза (1.1.0): редактор карт — выделение региона (инструмент SELECT/клавиша B), копирование/вырезание/удаление (C/X/Delete), вставка с ghost-превью, поворотом (R) и защитой от пересечений (V).

- [ ] **Step 3: Самостоятельное ревью диффа**

`git diff release_1.1.0...HEAD` — вычитать на предмет: магические числа, мёртвый код, дубли, UI-«прыжки» хотбара (кнопка SELECT не должна менять размеры соседних).

- [ ] **Step 4: Commit + merge по GitFlow**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog — копирование/вставка блоков в редакторе карт"
```

После аппрува пользователя — merge `feature/editor-copy-paste` → `release_1.1.0` (пуш и мерж в master делает пользователь).
