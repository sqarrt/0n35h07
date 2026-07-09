# Editor Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Автосохранение карты в редакторе (дебаунс 3 с, полный сейв raw+geo+preview) + бэкап на начало сессии с кнопкой REVERT + keepalive-запись при закрытии вкладки.

**Architecture:** Конвейер сохранения выносится из `MapEditor.doSave` в хук `useMapSaver` (очередь глубиной 1, коалесценция); автосейв — дебаунс-эффект в `MapEditor`; мост получает `backup.json`, `mapsApi` — `loadBackup`/`saveBackup` и keepalive-опцию. Спека: `docs/superpowers/specs/2026-07-08-editor-autosave-design.md`.

**Tech Stack:** TypeScript 6 (erasableSyntaxOnly), React 19, Vite dev-мост (`/__maps`).

## Global Constraints

- Ветка `feature/editor-copy-paste` (продолжение работ по редактору); коммит после каждой задачи.
- vitest/playwright сам НЕ запускать; после каждой задачи `npx tsc -b --noEmit`, в финале `npm run lint`.
- Константы именованные: `AUTOSAVE_DEBOUNCE_MS = 3000` (в `MapEditor.tsx`).
- Новых юнит-тестов нет (склейка React/сеть/WebGL — вне jsdom-паттерна проекта); проверка руками в dev.

---

### Task 1: мост + mapsApi — backup.json и keepalive

**Files:**
- Modify: `build/vite-plugins/editorMaps.ts:17-18`
- Modify: `src/editor/mapsApi.ts`

**Interfaces:**
- Produces:
  - `loadBackup(id: string): Promise<MapData | null>`
  - `saveBackup(id: string, map: MapData): Promise<boolean>`
  - `saveMap(id, map, opts?: { keepalive?: boolean })`, `saveCompiled(id, geoJson, opts?: { keepalive?: boolean })` — прежние вызовы без opts не меняются.

- [ ] **Step 1: Мост — разрешить backup.json**

В `build/vite-plugins/editorMaps.ts`:

```ts
const PARTS = new Set(['raw.json', 'geo.json', 'preview.png', 'backup.json'])
const CT: Record<string, string> = { 'raw.json': 'application/json', 'geo.json': 'application/json', 'preview.png': 'image/png', 'backup.json': 'application/json' }
```

(Комментарий-шапку файла дополнить `backup.json` в списке part.)

- [ ] **Step 2: mapsApi — backup и keepalive**

В `src/editor/mapsApi.ts`:

```ts
export async function saveMap(id: string, map: MapData, opts?: { keepalive?: boolean }): Promise<boolean> {
  return put(`${enc(id)}/raw.json`, serializeMap(map), 'application/json', opts?.keepalive)
}

/** Compiled geometry (geo.json). */
export async function saveCompiled(id: string, geoJson: string, opts?: { keepalive?: boolean }): Promise<boolean> {
  return put(`${enc(id)}/geo.json`, geoJson, 'application/json', opts?.keepalive)
}

/** Бэкап состояния на начало сессии редактора (backup.json). */
export async function loadBackup(id: string): Promise<MapData | null> {
  try {
    const r = await fetch(`${BASE}/${enc(id)}/backup.json`)
    return r.ok ? parseMap(await r.text()) : null
  } catch { return null }
}

export async function saveBackup(id: string, map: MapData): Promise<boolean> {
  return put(`${enc(id)}/backup.json`, serializeMap(map), 'application/json')
}

async function put(pathPart: string, body: string, contentType: string, keepalive = false): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${pathPart}`, { method: 'PUT', headers: { 'content-type': contentType }, body, keepalive })
    return r.ok
  } catch { return false }
}
```

- [ ] **Step 3: Проверка типов**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add build/vite-plugins/editorMaps.ts src/editor/mapsApi.ts
git commit -m "feat(editor): мост и mapsApi — backup.json и keepalive-запись"
```

---

### Task 2: хук useMapSaver — конвейер сохранения с очередью

**Files:**
- Create: `src/editor/useMapSaver.tsx`

**Interfaces:**
- Consumes: `saveMap`/`saveCompiled`/`saveThumbnail` из Task 1; `compileBlocks`, `serializeGeo` из `src/game/mapGeometryCache`; `ThumbnailRenderer` из `src/components/MapPreview` (пропсы `map: GameMap`, `onCapture: (dataUrl: string | null) => void`).
- Produces: `useMapSaver(name: string): { save: (data: MapData) => void; flush: (data: MapData) => void; status: string; thumbEl: ReactNode }`.

- [ ] **Step 1: Написать хук**

Создать `src/editor/useMapSaver.tsx`:

```tsx
import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import type { GameMap } from '../game/maps'
import { compileBlocks, serializeGeo } from '../game/mapGeometryCache'
import { ThumbnailRenderer } from '../components/MapPreview'
import type { MapData } from './editorStore'
import { saveMap, saveCompiled, saveThumbnail } from './mapsApi'

/**
 * Конвейер сохранения карты: raw.json → geo.json → preview.png (offscreen-рендер через ThumbnailRenderer).
 * Очередь глубиной 1: save() во время записи коалесцируется в один повторный сейв с последними данными —
 * двух параллельных ThumbnailRenderer не бывает. flush() — keepalive-запись raw+geo для pagehide.
 */
export function useMapSaver(name: string): { save: (data: MapData) => void; flush: (data: MapData) => void; status: string; thumbEl: ReactNode } {
  const [status, setStatus] = useState('')
  const [thumbMap, setThumbMap] = useState<GameMap | null>(null)
  const busy = useRef(false)
  const queued = useRef<MapData | null>(null)

  // Завершение цикла: статус + запуск отложенного сейва, если за время записи пришли новые данные.
  const finish = (msg: string) => {
    setStatus(msg)
    busy.current = false
    const next = queued.current
    queued.current = null
    if (next) start(next)
  }

  const start = (data: MapData) => {
    busy.current = true
    setStatus('saving…')
    void (async () => {
      const rawOk = await saveMap(name, data)
      const geoOk = rawOk && await saveCompiled(name, serializeGeo(compileBlocks(data.blocks)))
      if (!geoOk) { finish('save error'); return }
      setThumbMap(data as unknown as GameMap)   // монтирует ThumbnailRenderer → onThumb продолжит цикл
    })()
  }

  const onThumb = (dataUrl: string | null) => {
    setThumbMap(null)
    void (async () => {
      const pngOk = dataUrl ? await saveThumbnail(name, dataUrl) : false
      finish(pngOk ? `saved ${new Date().toLocaleTimeString()}` : 'saved (no preview)')
    })()
  }

  const save = (data: MapData) => {
    if (busy.current) { queued.current = data; return }
    start(data)
  }

  const flush = (data: MapData) => {
    void saveMap(name, data, { keepalive: true })
    void saveCompiled(name, serializeGeo(compileBlocks(data.blocks)), { keepalive: true })
  }

  const thumbEl = thumbMap ? <ThumbnailRenderer map={thumbMap} onCapture={onThumb} /> : null
  return { save, flush, status, thumbEl }
}
```

- [ ] **Step 2: Проверка типов**

Run: `npx tsc -b --noEmit`
Expected: без ошибок (хук ещё не подключён — это следующая задача).

- [ ] **Step 3: Commit**

```bash
git add src/editor/useMapSaver.tsx
git commit -m "feat(editor): useMapSaver — конвейер сохранения с очередью-коалесценцией"
```

---

### Task 3: MapEditor — автосейв, бэкап, REVERT, pagehide

**Files:**
- Modify: `src/editor/MapEditor.tsx`

**Interfaces:**
- Consumes: `useMapSaver` (Task 2), `loadBackup`/`saveBackup` (Task 1).

- [ ] **Step 1: Подключить useMapSaver вместо doSave/onThumb/thumbMap/status**

В `src/editor/MapEditor.tsx`:

1. Импорты: добавить `import { useMapSaver } from './useMapSaver'`; в импорт из `./mapsApi` добавить `loadBackup, saveBackup`; удалить ставшие ненужными импорты `compileBlocks, serializeGeo` (из `../game/mapGeometryCache`), `ThumbnailRenderer` (из `../components/MapPreview`), `saveMap, saveCompiled, saveThumbnail` (из `./mapsApi`) и `saveCompiled`-типы, а также тип `GameMap`, если больше не используется.

2. Константа рядом с `TOOL_KEYS`:

```ts
const AUTOSAVE_DEBOUNCE_MS = 3000   // пауза после последней правки до автосейва
```

3. Удалить состояния `status`, `thumbMap` и функции `doSave`, `onThumb`; вместо них:

```ts
  const { save, flush, status, thumbEl } = useMapSaver(name)
  const [hasBackup, setHasBackup] = useState(false)
  const fromDisk = useRef(true)    // данные пришли с диска (загрузка/REVERT) — не триггерят автосейв
  const dirty = useRef(false)      // есть несохранённые правки (для pagehide-flush)
```

(добавить `useRef` в импорт из `react`.)

4. `loadInto` помечает данные чистыми — первой строкой:

```ts
  const loadInto = useCallback((data: MapData) => {
    fromDisk.current = true
    ...существующие сеттеры...
  }, [])
```

5. Эффект загрузки — после успешной загрузки существующей карты писать бэкап:

```ts
  useEffect(() => {
    let alive = true
    void loadMap(name).then(data => {
      if (!alive) return
      if (data) {
        loadInto(data)
        void saveBackup(name, data).then(ok => { if (alive && ok) setHasBackup(true) })
      }
      setLoaded(true)
    })
    return () => { alive = false }
  }, [name, loadInto])
```

- [ ] **Step 2: Автосейв-эффект и pagehide**

После `buildMap` добавить:

```ts
  // Автосейв: дебаунс после последней правки. Загрузка с диска (fromDisk) один раз пропускается.
  useEffect(() => {
    if (!loaded) return
    if (fromDisk.current) { fromDisk.current = false; return }
    dirty.current = true
    const t = setTimeout(() => { dirty.current = false; save(buildMap()) }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [voxels, half, floorColor, wallColor, spawns, showGridInGame, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Закрытие вкладки посреди дебаунса: keepalive-запись raw+geo (превью догонит следующий сейв).
  useEffect(() => {
    const onHide = () => { if (dirty.current) flush(buildMap()) }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }) // без deps: дешёвая переподписка, зато buildMap всегда свежий
```

- [ ] **Step 3: Кнопки SAVE/REVERT и рендер thumbEl**

1. Ряд с кнопкой SAVE:

```tsx
        <div className="editor-row">
          <button className="btn" onClick={() => save(buildMap())}>SAVE</button>
          {hasBackup && <button className="btn" onClick={doRevert}>REVERT</button>}
          {status && <span className="editor-dim">{status}</span>}
        </div>
```

2. `doRevert` рядом с `buildMap`:

```ts
  // Откат к состоянию на начало сессии: загрузить бэкап и сразу сохранить его как текущее.
  const doRevert = async () => {
    if (!window.confirm(`Revert "${name}" to the session-start backup?`)) return
    const data = await loadBackup(name)
    if (!data) return
    loadInto(data)
    save({ ...data, id: name })   // явный сейв: данные «чистые», автосейв их не подхватит
  }
```

3. Внизу JSX заменить блок офскрин-рендера:

```tsx
      {/* Offscreen preview render on save (preview.png) */}
      {thumbEl}
```

- [ ] **Step 4: Проверка типов и линта**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/editor/MapEditor.tsx
git commit -m "feat(editor): автосейв с дебаунсом, бэкап сессии + REVERT, keepalive при закрытии"
```

---

### Task 4: финал — changelog и ручная проверка

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Changelog**

В раздел `## [1.1.0]` → `### Added`, после записи про copy/paste редактора:

```markdown
- **Map editor: autosave.** The editor now saves on its own — a 3-second pause after the last edit writes all
  three artifacts (source, compiled geometry, preview). Opening an existing map snapshots it to a session backup;
  a REVERT button restores that snapshot. Closing the tab mid-pause still flushes the map source. The SAVE button
  remains as an immediate manual save.
```

- [ ] **Step 2: Ручная проверка пользователем**

- правка → пауза 3 с → статус `saving… → saved HH:MM:SS`, `raw/geo/preview` обновились;
- непрерывная стройка → сейв не мешает, после остановки один сейв (коалесценция);
- REVERT возвращает состояние на открытие карты и сразу сохраняет его;
- закрытие вкладки сразу после правки → raw.json свежий при повторном открытии;
- новая карта (несуществующая): REVERT скрыт, автосейв создаёт папку карты.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog — автосохранение в редакторе карт"
```
