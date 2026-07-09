# Editor Wedge On-Side (Diagonal Wall) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Клин можно класть «на бок» — вертикальная диагональная стена (гипотенуза 45° на всю высоту ячейки), с корректным рендером и коллайдером в игре.

**Architecture:** Общий хелпер `wedgeQuaternion(dir, side)` в `wedge.ts` (on-side = roll 90° вокруг Z, затем yaw) применяется в игре (`blockGeometry`, коллайдер — trimesh, бесплатно) и в редакторе (меши/ghost). `Cell` получает опциональный `s?: boolean`, `MapBlock` — `side?: boolean`. Клавиша G в редакторе переключает on-side. Спека: `docs/superpowers/specs/2026-07-09-editor-wedge-onside-design.md`.

**Tech Stack:** TypeScript 6 (erasableSyntaxOnly), React 19, Three.js 0.184, vitest.

## Global Constraints

- Ветка `feature/editor-copy-paste`; коммит после каждой задачи.
- vitest/playwright сам НЕ запускать; после каждой задачи `npx tsc -b --noEmit`, в финале `npm run lint`.
- `s` на `Cell` — опциональный, «truthy = on-side»: `voxelize` добавляет `s` только для on-side, поэтому существующие тесты не трогаются; чтение везде через `cell.s === true` / `!!cell.s`.
- Для on-side флип (`f`) игнорируется во всех путях (призма симметрична по Y).

---

### Task 1: игра — wedgeQuaternion + MapBlock.side + blockGeometry (+тест)

**Files:**
- Modify: `src/game/wedge.ts`
- Modify: `src/game/maps.ts:32`
- Modify: `src/game/blockGeometry.ts:15-24`
- Create: `tests/unit/wedge.test.ts`

**Interfaces:**
- Produces:
  - `wedgeQuaternion(dir: number, side: boolean, out?: THREE.Quaternion): THREE.Quaternion`
  - `wedgeEuler(dir: number, side: boolean): [number, number, number]`
  - `MapBlock.side?: boolean`

- [ ] **Step 1: Хелперы в wedge.ts**

В конец `src/game/wedge.ts` (после `wedgeRotationY`):

```ts
const _yAxis = new THREE.Vector3(0, 1, 0)
const _zAxis = new THREE.Vector3(0, 0, 1)
const _yaw = new THREE.Quaternion()
const _roll = new THREE.Quaternion()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

/** Ориентация клина. side=false — чистый yaw по dir (как раньше). side=true (диагональная стена) —
 *  roll 90° вокруг Z (ось выдавливания X→вертикаль), затем yaw по dir. */
export function wedgeQuaternion(dir: number, side: boolean, out = new THREE.Quaternion()): THREE.Quaternion {
  _yaw.setFromAxisAngle(_yAxis, wedgeRotationY(dir))
  if (!side) return out.copy(_yaw)
  _roll.setFromAxisAngle(_zAxis, Math.PI / 2)
  return out.copy(_yaw).multiply(_roll)   // сначала roll, затем yaw
}

/** Та же ориентация как Euler [x,y,z] — для декларативного `rotation` у мешей. */
export function wedgeEuler(dir: number, side: boolean): [number, number, number] {
  _e.setFromQuaternion(wedgeQuaternion(dir, side, _q))
  return [_e.x, _e.y, _e.z]
}
```

- [ ] **Step 2: MapBlock.side**

В `src/game/maps.ts` после строки `flip?: boolean ...` (32):

```ts
  side?: boolean       // wedge laid on its side — vertical diagonal wall; ignores flip
```

- [ ] **Step 3: blockGeometry применяет поворот**

В `src/game/blockGeometry.ts` заменить импорт и wedge-ветку:

```ts
import { wedgeQuaternion } from './wedge'
```

```ts
  if (b.shape === 'wedge') {
    const useFlip = b.side ? false : b.flip     // on-side игнорирует флип (призма симметрична по Y)
    g = (useFlip ? wedgeGeoFlip : wedgeGeo).clone()
    g.scale(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
    g.applyQuaternion(wedgeQuaternion(b.dir ?? 0, b.side === true))
  } else {
```

(Для `side=false` `wedgeQuaternion` == чистый yaw, т.е. полностью совпадает с прежним `rotateY(wedgeRotationY(dir))` — существующие карты не меняются. Коллайдер — trimesh из этой же геометрии в `bucketedBlockGeometries`, поворот наследуется.)

- [ ] **Step 4: Тест**

Создать `tests/unit/wedge.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { wedgeQuaternion, wedgeRotationY } from '../../src/game/wedge'

describe('wedge orientation', () => {
  it('side=false — чистый yaw по dir (прежнее поведение)', () => {
    for (const d of [0, 1, 2, 3]) {
      const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wedgeRotationY(d))
      expect(wedgeQuaternion(d, false).angleTo(expected)).toBeCloseTo(0)
    }
  })

  it('side=true — ось выдавливания (X) встаёт вертикально (диагональная стена)', () => {
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(wedgeQuaternion(0, true))
    expect(Math.abs(axis.y)).toBeCloseTo(1)
    expect(Math.abs(axis.x)).toBeCloseTo(0)
    expect(Math.abs(axis.z)).toBeCloseTo(0)
  })
})
```

- [ ] **Step 5: Проверка типов и коммит**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

```bash
git add src/game/wedge.ts src/game/maps.ts src/game/blockGeometry.ts tests/unit/wedge.test.ts
git commit -m "feat(wedge): wedgeQuaternion + MapBlock.side — клин на боку в игре (рендер+коллайдер)"
```

---

### Task 2: editorStore — Cell.s + shapeBlock/voxelize (+тест round-trip)

**Files:**
- Modify: `src/editor/editorStore.ts:16,94-102,159-186`
- Modify: `tests/unit/editorStore.test.ts:73-85`

**Interfaces:**
- Consumes: `MapBlock.side` (Task 1).
- Produces: `Cell.s?: boolean` в `src/editor/editorStore.ts`.

- [ ] **Step 1: Cell.s**

В `src/editor/editorStore.ts:16` добавить поле:

```ts
export interface Cell { t: BlockType; c: string; d: Dir; f: boolean; s?: boolean; bb: boolean; tr: boolean; ps: boolean }
```

(комментарий выше дополнить: `s — on-side (диагональная стена), для клина; при on-side флип игнорируется`.)

- [ ] **Step 2: shapeBlock пишет side**

В `shapeBlock` (после `const b: MapBlock = {...}`), заменить строку `if (cell.f) b.flip = true` на:

```ts
  if (cell.f && !cell.s) b.flip = true     // on-side игнорирует флип
  if (cell.s) b.side = true
```

- [ ] **Step 3: voxelize читает side**

В `voxelize`, wedge-ветка — сейчас:

```ts
      v.set(cellKey(x, y, z), { t: 'wedge', c: b.color, d: (b.dir ?? 0) as Dir, f: !!b.flip, bb, tr, ps })
```

заменить на (добавляем `s` только для on-side, чтобы обычные клинья round-trip'или как раньше):

```ts
      const wcell: Cell = { t: 'wedge', c: b.color, d: (b.dir ?? 0) as Dir, f: !!b.flip, bb, tr, ps }
      if (b.side === true) wcell.s = true
      v.set(cellKey(x, y, z), wcell)
```

(Cube-ветку не трогаем — `s` там не появляется.)

- [ ] **Step 4: Тест round-trip on-side**

В `tests/unit/editorStore.test.ts`, в тест `type round-trip: cube and wedge(4 dir, normal/flipped)` (73-85) добавить в Map строку с on-side клином:

```ts
      [cellKey(10, 0, 0), { t: 'wedge', c: '#666', d: 1, s: true, f: false, ...DEF }],
```

(остальные строки не меняются — обычные клинья без `s` round-trip'ят как прежде.)

- [ ] **Step 5: Проверка типов и коммит**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

```bash
git add src/editor/editorStore.ts tests/unit/editorStore.test.ts
git commit -m "feat(editor): Cell.s — сериализация клина на боку (shapeBlock/voxelize round-trip)"
```

---

### Task 3: редактор — клавиша G, ghost и меши on-side

**Files:**
- Modify: `src/editor/MapEditor.tsx`
- Modify: `src/editor/EditorScene.tsx`

**Interfaces:**
- Consumes: `wedgeQuaternion`, `wedgeEuler` (Task 1); `Cell.s` (Task 2).

- [ ] **Step 1: MapEditor — состояние, клавиша, проп, хинт**

В `src/editor/MapEditor.tsx`:

1. Состояние рядом с `wedgeFlip`:

```ts
  const [wedgeSide, setWedgeSide] = useState(false)   // G: клин на боку (диагональная стена)
```

2. В `onKey` после ветки `KeyT`:

```ts
      if (e.code === 'KeyG') { setWedgeSide(v => !v); return }
```

3. Проп в `<EditorScene ...>` рядом с `wedgeFlip`:

```tsx
          wedgeSide={wedgeSide}
```

4. Хинт (`className="editor-hint"`): фрагмент `tool === 'wedge' ? ' · R — rotate, T — flip wedge' : ''` заменить на:

```tsx
{tool === 'wedge' ? ' · R — rotate, T — flip, G — on-side' : ''}
```

- [ ] **Step 2: EditorScene — проп и импорт**

В `src/editor/EditorScene.tsx`:

1. Импорт из `../game/wedge` заменить (после замен `wedgeRotationY` в EditorScene не используется — убираем, иначе lint на неиспользуемый импорт):

```ts
import { unitWedgeGeometry, wedgeQuaternion, wedgeEuler } from '../game/wedge'
```

2. В `interface Props` рядом с `wedgeFlip`:

```ts
  wedgeSide: boolean            // клин на боку (диагональная стена) — G
```

3. В деструктуризацию `props` добавить `wedgeSide`.

- [ ] **Step 3: EditorScene — меши клиньев (ShapeMeshes)**

Заменить `<mesh>` в `ShapeMeshes` (строки 160-165):

```tsx
      {shapes.map(({ key, b }) => (
        <mesh key={key} position={b.pos} rotation={wedgeEuler(b.dir ?? 0, b.side === true)} geometry={(b.side ? false : b.flip) ? wedgeGeoFlip : wedgeGeo}
          scale={[b.size[0] * 2, b.size[1] * 2, b.size[2] * 2]} castShadow receiveShadow
          userData={{ editorTarget: true, cellKey: key }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
          <meshStandardMaterial color={b.color} transparent={b.transparent === true} opacity={b.transparent ? BLOCK_TRANSPARENT_OPACITY : 1} depthWrite={b.transparent !== true} />
        </mesh>
      ))}
```

- [ ] **Step 4: EditorScene — paste-ghost клиньев**

В `pasteGroup` (строки 220-223) заменить:

```ts
      const wm = new THREE.Mesh((!cell.s && cell.f) ? wedgeGeoFlip : wedgeGeo, pasteMat)
      wm.position.set(...b.pos)
      wm.quaternion.copy(wedgeQuaternion(cell.d, cell.s === true))
      wm.scale.set(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
```

- [ ] **Step 5: EditorScene — установка и ghost кисти клина**

1. Установка (`act`, строка ~307) — добавить `s` в кладущийся Cell:

```ts
          onPlace(c.place, { t: tool, c: color, d: isWedge ? wedgeDir(f.x, f.z, wedgeRot) : 0, f: isWedge && wedgeFlip, s: isWedge && wedgeSide, bb: brushBeam, tr: brushTransparent, ps: brushPassable })
```

2. Ghost кисти клина (`useFrame`, строки ~455-459):

```ts
        const d = wedgeDir(f.x, f.z, wedgeRot)
        const b = shapeBlock(x, y, z, { t: 'wedge', c: color, d, f: wedgeFlip, s: wedgeSide, bb: brushBeam, tr: brushTransparent, ps: brushPassable })
        gw.geometry = (!wedgeSide && wedgeFlip) ? wedgeGeoFlip : wedgeGeo
        gw.position.set(...b.pos)
        gw.quaternion.copy(wedgeQuaternion(d, wedgeSide))
        gw.scale.set(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
```

(строку `gw.rotation.set(0, wedgeRotationY(d), 0)` удалить — её заменяет `gw.quaternion.copy(...)`.)

3. В deps основного `useEffect` (обработчики мыши/клавиш, строка ~341) добавить `wedgeSide`.

- [ ] **Step 6: EditorScene — коллизия в редакторе (cellTopAt)**

В `cellTopAt` условие наклонной поверхности — сейчас `if (cell.t === 'wedge' && !cell.f)` — заменить на:

```ts
    if (cell.t === 'wedge' && !cell.f && !cell.s) {
```

(on-side клин трактуется как плоский верх/сплошная преграда — приемлемое огрубление для ходьбы по редактору.)

- [ ] **Step 7: Проверка типов, линт и коммит**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: без ошибок.

```bash
git add src/editor/MapEditor.tsx src/editor/EditorScene.tsx
git commit -m "feat(editor): клавиша G — клин на боку (диагональная стена), ghost и меши"
```

---

### Task 4: финал — changelog и ручная проверка

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Changelog**

В `## [1.1.0]` → `### Added`, после записи про свойства выделения:

```markdown
- **Map editor: wedges on their side.** A wedge can now be laid on its side (key **G**) as a vertical diagonal
  wall — a full-height 45° corner for angled rooms and diagonal passages. R still picks which of the four corners;
  the wall renders, collides and blocks/passes beams by the usual flags in-game.
```

- [ ] **Step 2: Ручная проверка пользователем**

- в режиме WEDGE клавиша G кладёт клин на бок: ghost — вертикальная диагональ; R крутит по 4 углам; T (флип) на on-side не влияет;
- поставленный on-side клин в редакторе выглядит диагональной стеной; в игре — коллайдит (упираешься в диагональ) и простреливается/проходится по флагам;
- обычные клинья (рампы, флип) не изменились; существующие карты выглядят как прежде;
- copy-paste on-side стены: поворот фрагмента R крутит их корректно.

Если диагональ по умолчанию (d=0) срезает «не тот» угол — поменять знак roll в `wedgeQuaternion` (`-Math.PI/2`); это косметика ориентации по умолчанию.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog — клин на боку в редакторе карт"
```
