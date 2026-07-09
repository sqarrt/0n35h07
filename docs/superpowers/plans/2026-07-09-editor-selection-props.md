# Editor Selection-Props Live Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пока в редакторе есть зафиксированное выделение, контролы кисти в хотбаре (цвет / Opaque / Beam / Passable) применяют своё свойство ко всем блокам региона.

**Architecture:** Чистая функция `patchRegion` в `editorSelection.ts` (юнит-тест) + хелпер `patchSelection` в `MapEditor`, вызываемый из onClick каждого контрола рядом с существующим сеттером кисти. Спека: `docs/superpowers/specs/2026-07-09-editor-selection-props-design.md`.

**Tech Stack:** TypeScript 6 (erasableSyntaxOnly), React 19, vitest.

## Global Constraints

- Ветка `feature/editor-copy-paste`; коммит после каждой задачи.
- vitest/playwright сам НЕ запускать; после каждой задачи `npx tsc -b --noEmit`, в финале `npm run lint`.
- Условие применения — `selection?.b` (оба угла), как у C/X/Delete; тип/ориентация wedge (`t`/`d`/`f`) не трогаются.

---

### Task 1: patchRegion (+тест)

**Files:**
- Modify: `src/editor/editorSelection.ts`
- Modify: `tests/unit/editorSelection.test.ts`

**Interfaces:**
- Consumes: `regionBounds`, `inRegion` (уже в файле), `cellKey`/`parseCellKey`, `Cell`.
- Produces:
  - `type RegionPatch = Partial<Pick<Cell, 'c' | 'bb' | 'tr' | 'ps'>>`
  - `patchRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i, patch: RegionPatch): Map<string, Cell>`

- [ ] **Step 1: Написать падающий тест**

Добавить в конец `tests/unit/editorSelection.test.ts` (импорт `patchRegion` в общий import из `../../src/editor/editorSelection`):

```ts
describe('editorSelection — patchRegion', () => {
  it('применяет патч только к региону, t/d/f и соседи целы, Map не мутируется', () => {
    const v = new Map<string, Cell>([
      [cellKey(0, 0, 0), cube({ c: '#111' })],
      [cellKey(1, 0, 0), wedge(2)],
      [cellKey(5, 0, 0), cube({ c: '#999' })],   // вне региона
    ])
    const out = patchRegion(v, [0, 0, 0], [1, 0, 0], { c: '#4af', ps: true })
    expect(out.get(cellKey(0, 0, 0))).toEqual(cube({ c: '#4af', ps: true }))
    // wedge: цвет+ps применены, тип и dir целы
    expect(out.get(cellKey(1, 0, 0))).toEqual({ t: 'wedge', c: '#4af', d: 2, f: false, bb: true, tr: false, ps: true })
    expect(out.get(cellKey(5, 0, 0))).toEqual(cube({ c: '#999' }))   // сосед не тронут
    expect(v.get(cellKey(0, 0, 0))).toEqual(cube({ c: '#111' }))     // исходная Map цела
  })

  it('частичный патч меняет только заданные поля', () => {
    const v = new Map<string, Cell>([[cellKey(0, 0, 0), cube({ c: '#111', bb: true, tr: false, ps: false })]])
    expect(patchRegion(v, [0, 0, 0], [0, 0, 0], { tr: true }).get(cellKey(0, 0, 0)))
      .toEqual(cube({ c: '#111', bb: true, tr: true, ps: false }))
    expect(patchRegion(v, [0, 0, 0], [0, 0, 0], { bb: false }).get(cellKey(0, 0, 0)))
      .toEqual(cube({ c: '#111', bb: false, tr: false, ps: false }))
  })
})
```

- [ ] **Step 2: Реализация**

Добавить в `src/editor/editorSelection.ts` (после `eraseRegion`):

```ts
/** Патч свойств блока (без типа/ориентации) — то, что задаёт кисть хотбара. */
export type RegionPatch = Partial<Pick<Cell, 'c' | 'bb' | 'tr' | 'ps'>>

/** Применить патч ко всем ячейкам региона (t/d/f сохранены). Новая Map. */
export function patchRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i, patch: RegionPatch): Map<string, Cell> {
  const { min, max } = regionBounds(a, b)
  const next = new Map(voxels)
  for (const [k, cell] of voxels) {
    const [x, y, z] = parseCellKey(k)
    if (inRegion(x, y, z, min, max)) next.set(k, { ...cell, ...patch })
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
git commit -m "feat(editor): patchRegion — патч свойств блоков региона"
```

---

### Task 2: живая панель — patchSelection в MapEditor

**Files:**
- Modify: `src/editor/MapEditor.tsx`

**Interfaces:**
- Consumes: `patchRegion`, `RegionPatch` (Task 1); `selection`, `setVoxels`.

- [ ] **Step 1: Импорт и хелпер**

В `src/editor/MapEditor.tsx`:

1. В импорт из `./editorSelection` добавить `patchRegion` (значение) и `RegionPatch` (тип):

```ts
import { extractRegion, eraseRegion, rotateFragment, canStamp, stampFragment, patchRegion } from './editorSelection'
import type { Fragment, RegionPatch } from './editorSelection'
```

2. Хелпер рядом с `onCorner`/`onSelectionClear`:

```ts
  // Живая панель: при зафиксированном выделении контрол кисти применяет своё свойство к региону.
  const patchSelection = useCallback((patch: RegionPatch) => {
    setSelection(sel => {
      if (sel?.b) setVoxels(prev => patchRegion(prev, sel.a, sel.b!, patch))
      return sel
    })
  }, [])
```

(Читаем актуальное `selection` через функциональный `setSelection`, возвращая его без изменений — так хелпер не зависит от `selection` и не пересоздаётся.)

- [ ] **Step 2: Подключить контролы хотбара**

В JSX хотбара:

1. Инлайн-свотчи блочного цвета:

```tsx
        {EDITOR_COLORS.map(c => (
          <span key={c} className={`swatch${c === color ? ' swatch--sel' : ''}`} style={{ background: c, color: c }} onClick={() => { setColor(c); patchSelection({ c }) }} />
        ))}
```

2. Кнопка Opaque/Semi-transparent:

```tsx
        <button className={`seg${!brushTransparent ? ' seg--on' : ''}`} data-testid="ed-opaque" onClick={() => { const v = !brushTransparent; setBrushTransparent(v); patchSelection({ tr: v }) }}>
          {brushTransparent ? 'Semi-transparent' : 'Opaque'}
        </button>
```

3. Кнопка Beam:

```tsx
        <button className={`seg${brushBeam ? ' seg--on' : ''}`} data-testid="ed-beam" onClick={() => { const v = !brushBeam; setBrushBeam(v); patchSelection({ bb: v }) }}>
          {brushBeam ? 'Beam-blocking' : 'Shoot-through'}
        </button>
```

4. Кнопка Passable:

```tsx
        <button className={`seg${!brushPassable ? ' seg--on' : ''}`} data-testid="ed-passable" onClick={() => { const v = !brushPassable; setBrushPassable(v); patchSelection({ ps: v }) }}>
          {brushPassable ? 'Passable' : 'Solid'}
        </button>
```

(Палитры FLOOR/WALLS через `Palette` не трогать.)

- [ ] **Step 3: Проверка типов и линта**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: без ошибок.

- [ ] **Step 4: Ручная проверка пользователем**

- выделить регион (SELECT, два угла), ESC → клик по цвету перекрашивает регион; тумблеры Opaque/Beam/Passable меняют соответствующее свойство всех блоков; выделение остаётся, можно менять несколько свойств подряд;
- без выделения контролы работают как раньше (только меняют кисть);
- wedge в регионе меняет цвет/флаги, но остаётся wedge с прежней ориентацией.

- [ ] **Step 5: Commit**

```bash
git add src/editor/MapEditor.tsx
git commit -m "feat(editor): живая панель — свойства кисти применяются к выделению"
```

---

### Task 3: changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Запись**

В `## [1.1.0]` → `### Added`, после записи про autosave:

```markdown
- **Map editor: edit properties of a selection.** With a box selected, the hotbar brush controls act on the
  selected blocks: pick a color to recolor them, toggle Opaque / Beam-blocking / Passable to change that property
  across the whole region. The selection stays put so several properties can be tweaked in a row; block type and
  wedge orientation are untouched.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog — редактирование свойств выделения в редакторе"
```
