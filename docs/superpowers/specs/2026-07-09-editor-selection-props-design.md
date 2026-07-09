# Редактор карт: живое редактирование свойств выделения

Дата: 2026-07-09 · Ветка: `feature/editor-copy-paste` (продолжение работ по редактору, от `release_1.1.0`)

## Цель

Пока в редакторе есть зафиксированное выделение (инструмент SELECT, два угла), панель кисти в
хотбаре редактирует свойства уже стоящих блоков региона: смена цвета или переключение
Opaque/Beam/Passable сразу применяется ко всем блокам выделения. Отдельных горячих клавиш нет —
работает та же панель, что задаёт кисть для новых блоков.

## Поведение

- Условие: `selection?.b` — оба угла зафиксированы (как у C/X/Delete).
- Контролы хотбара, при активном выделении, применяют **одно своё свойство** ко всем блокам
  региона:
  - палитра цвета (инлайн-свотчи блочного цвета) → `c`;
  - кнопка Opaque / Semi-transparent → `tr`;
  - кнопка Beam-blocking / Shoot-through → `bb`;
  - кнопка Solid / Passable → `ps`.
- Тип блока и ориентация wedge (`t`, `d`, `f`) не изменяются.
- Тот же клик, как и раньше, обновляет состояние кисти (`color` / `brushTransparent` /
  `brushBeam` / `brushPassable`) для будущих блоков — контрол делает двойную работу.
- Выделение **не сбрасывается** после применения (в отличие от C/X/Delete) — можно менять
  несколько свойств подряд на одном регионе. Сброс — ПКМ в инструменте SELECT.
- Пойнтер-лок не требуется: кнопки панели кликаются только с видимым курсором (после ESC), а
  выделение переживает выход из lock.
- Правка идёт через `setVoxels` (новая Map) — автосейв подхватывает её штатно.

### Что не трогаем

- Палитры FLOOR и WALLS в боковой панели (`Palette` — цвет пола/стен), они к блокам не относятся.
- Тип блока и ориентацию wedge у выделенных блоков.
- Поведение при отсутствии выделения (`selection` пуст или только один угол) — контролы работают
  как раньше, только меняя кисть.

## Архитектура

Паттерн проекта: чистая логика в `editorSelection.ts` (юнит-тест), тонкая обвязка в компоненте.

### `src/editor/editorSelection.ts`

```ts
/** Патч свойств блока (без типа/ориентации) — то, что задаёт кисть хотбара. */
export type RegionPatch = Partial<Pick<Cell, 'c' | 'bb' | 'tr' | 'ps'>>

/** Применить патч ко всем ячейкам региона (t/d/f сохранены). Новая Map. */
export function patchRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i, patch: RegionPatch): Map<string, Cell>
```

Реализация по образцу `eraseRegion`: `regionBounds` → для ячеек в регионе `next.set(k, { ...cell, ...patch })`.

### `src/editor/MapEditor.tsx`

- Хелпер `patchSelection(patch: RegionPatch)`: если `selection?.b`, то
  `setVoxels(prev => patchRegion(prev, selection.a, selection.b!, patch))`.
- Инлайн-свотчи блочного цвета в хотбаре: `onClick={() => { setColor(c); patchSelection({ c }) }}`.
- Кнопка Opaque/Semi-transparent: `onClick={() => { const v = !brushTransparent; setBrushTransparent(v); patchSelection({ tr: v }) }}`.
- Кнопка Beam: `onClick={() => { const v = !brushBeam; setBrushBeam(v); patchSelection({ bb: v }) }}`.
- Кнопка Passable: `onClick={() => { const v = !brushPassable; setBrushPassable(v); patchSelection({ ps: v }) }}`.
- `patchSelection` — `useCallback`, зависит от `selection`.

## Тесты

- Юнит `tests/unit/editorSelection.test.ts`: `patchRegion` — патч применяется только к региону;
  `t`/`d`/`f` целы; соседние ячейки целы; частичный патч (только `c`; только `ps`) работает;
  исходная Map не мутируется.
- UI-обвязка (клики панели → перекраска) — по проектному паттерну юнитами не покрывается
  (нет DOM-редактора в jsdom); проверка руками в dev.

## Процесс

- Работа в `feature/editor-copy-paste`; тесты запускает пользователь; агент — `tsc` и `lint`.
