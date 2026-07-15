# Map Chunking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Разбить визуальную геометрию карты на пространственные чанки, чтобы three.js отсекал невидимые части во всех проходах (основной, тени, обводка) — большие карты рендерятся с нормальным fps.

**Architecture:** `bucketedBlockGeometries`/`compileBlocks` группируют блоки по чанкам (сетка X/Z, по центру блока), каждый чанк — свои 4 группы; коллайдер остаётся одним trimesh. `Arena` рендерит меши по чанкам. geo.json нового формата пересобирается заранее dev-эндпоинтом. Спека: `docs/superpowers/specs/2026-07-10-map-chunking-design.md`.

**Tech Stack:** TypeScript 6, Three.js 0.184, React Three Fiber, Rapier, vitest, Vite dev-плагин.

## Global Constraints

- Ветка `feature/map-perf-chunks`; коммит после каждой задачи; после каждой `npx tsc -b --noEmit`, в финале `npm run lint`. vitest — пользователь (юнит-тесты three-геометрии в jsdom работают, но запуск — за ним).
- `CHUNK_SIZE = 8` мировых единиц (локальная константа в `blockGeometry.ts`).
- Коллайдер — один слитый trimesh (не чанкуется).
- `parseGeo` защитный: нет поля `chunks` → пустая `CompiledMap` (рантайм-фолбэк перекомпилирует).
- Файлы `src/maps/os_test/*` — живые правки пользователя; НЕ трогать/не коммитить. geo.json пересобирать и коммитить только для os_arena/os_india/os_pillars/os_pool_day.

---

### Task 1: чанкованная компиляция + сериализация (+тесты)

**Files:**
- Modify: `src/game/blockGeometry.ts`
- Modify: `src/game/mapGeometryCache.ts`
- Create: `tests/unit/mapChunks.test.ts`

**Interfaces:**
- Produces:
  - `blockGeometry.ts`: `interface ChunkBuckets { opaqueRaycast; opaqueNoRaycast; transparentRaycast; transparentNoRaycast: BufferGeometry|null }`, `interface BlockBuckets { chunks: ChunkBuckets[]; collider: BufferGeometry|null }`.
  - `mapGeometryCache.ts`: `interface ChunkGeo { opaqueRaycast; opaqueNoRaycast; transparentRaycast; transparentNoRaycast: GeoArrays|null }`, `interface CompiledMap { chunks: ChunkGeo[]; collider: GeoArrays|null }`.

- [ ] **Step 1: Тесты (падающие)**

Создать `tests/unit/mapChunks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { compileBlocks, serializeGeo, parseGeo, isEmptyCompiled } from '../../src/game/mapGeometryCache'
import type { MapBlock } from '../../src/game/maps'

const cube = (x: number, z: number, over: Partial<MapBlock> = {}): MapBlock =>
  ({ pos: [x, 0.25, z], size: [0.25, 0.25, 0.25], color: '#888', blocksBeam: true, ...over })

describe('map chunking', () => {
  it('блоки в разных чанках (по центру, шаг 8) идут в разные чанки; вершины не теряются', () => {
    // x=0 → чанк 0, x=20 → чанк 2 (20/8=2.5→2)
    const c = compileBlocks([cube(0, 0), cube(20, 0)])
    expect(c.chunks.length).toBe(2)
    // у каждого чанка ровно один opaqueRaycast-бокс (36 вершин non-indexed box)
    const opaqueVerts = c.chunks.map(ch => ch.opaqueRaycast?.position.length ?? 0)
    expect(opaqueVerts.filter(n => n > 0).length).toBe(2)
    expect(opaqueVerts.reduce((a, b) => a + b, 0)).toBe(2 * 36 * 3)   // 2 бокса × 36 верт × 3 компонента
    // коллайдер один и покрывает оба непроходимых бокса
    expect(c.collider?.position.length).toBe(2 * 36 * 3)
  })

  it('соседние блоки в одном чанке мёржатся в один чанк', () => {
    const c = compileBlocks([cube(0, 0), cube(0.5, 0)])   // оба в чанке 0
    expect(c.chunks.length).toBe(1)
  })

  it('passable-блок не попадает в коллайдер, но остаётся в визуале', () => {
    const c = compileBlocks([cube(0, 0, { passable: true })])
    expect(c.collider).toBeNull()
    expect(c.chunks[0].opaqueRaycast?.position.length).toBe(36 * 3)
  })

  it('serializeGeo → parseGeo — round-trip нового формата', () => {
    const c = compileBlocks([cube(0, 0), cube(20, 0)])
    const p = parseGeo(serializeGeo(c))
    expect(p.chunks.length).toBe(c.chunks.length)
    expect(p.collider?.position.length).toBe(c.collider?.position.length)
    expect(isEmptyCompiled(p)).toBe(false)
  })

  it('parseGeo старого формата (без chunks) → пустая CompiledMap (фолбэк)', () => {
    const old = JSON.stringify({ opaqueRaycast: null, collider: null })
    const p = parseGeo(old)
    expect(p.chunks).toEqual([])
    expect(isEmptyCompiled(p)).toBe(true)
  })
})
```

- [ ] **Step 2: blockGeometry.ts — чанкинг**

Заменить `BlockBuckets` и `bucketedBlockGeometries` (функция `blockGeometry(b, ...)` не меняется):

```ts
const CHUNK_SIZE = 8   // world units per chunk side (X/Z); full height — for frustum culling of large maps

export interface ChunkBuckets {
  opaqueRaycast: BufferGeometry | null
  opaqueNoRaycast: BufferGeometry | null
  transparentRaycast: BufferGeometry | null
  transparentNoRaycast: BufferGeometry | null
}
export interface BlockBuckets {
  chunks: ChunkBuckets[]
  collider: BufferGeometry | null
}

interface ChunkAccum { opaqueRay: BufferGeometry[]; opaqueNoRay: BufferGeometry[]; transpRay: BufferGeometry[]; transpNoRay: BufferGeometry[] }

/** Blocks → per-chunk merged visual groups (blocksBeam × transparent) + a single impassable collider. */
export function bucketedBlockGeometries(
  blocks: MapBlock[], wedgeGeo: BufferGeometry, wedgeGeoFlip: BufferGeometry,
): BlockBuckets {
  const chunkMap = new Map<string, ChunkAccum>()
  const collide: BufferGeometry[] = []
  for (const b of blocks) {
    const g = blockGeometry(b, wedgeGeo, wedgeGeoFlip)
    if (b.passable !== true) collide.push(g.clone())   // collider — a copy (visuals disposed below)
    const key = `${Math.floor(b.pos[0] / CHUNK_SIZE)},${Math.floor(b.pos[2] / CHUNK_SIZE)}`
    let acc = chunkMap.get(key)
    if (!acc) { acc = { opaqueRay: [], opaqueNoRay: [], transpRay: [], transpNoRay: [] }; chunkMap.set(key, acc) }
    const beam = b.blocksBeam !== false
    const transp = b.transparent === true
    ;(transp ? (beam ? acc.transpRay : acc.transpNoRay) : (beam ? acc.opaqueRay : acc.opaqueNoRay)).push(g)
  }
  const merge = (arr: BufferGeometry[]) => (arr.length ? mergeGeometries(arr) : null)
  const chunks: ChunkBuckets[] = []
  const toDispose: BufferGeometry[] = [...collide]
  for (const acc of chunkMap.values()) {
    chunks.push({
      opaqueRaycast: merge(acc.opaqueRay),
      opaqueNoRaycast: merge(acc.opaqueNoRay),
      transparentRaycast: merge(acc.transpRay),
      transparentNoRaycast: merge(acc.transpNoRay),
    })
    toDispose.push(...acc.opaqueRay, ...acc.opaqueNoRay, ...acc.transpRay, ...acc.transpNoRay)
  }
  const collider = merge(collide)
  for (const g of toDispose) g.dispose()
  return { chunks, collider }
}
```

- [ ] **Step 3: mapGeometryCache.ts — CompiledMap, compile, serialize/parse**

Заменить `CompiledMap`, `compileBlocks`, `isEmptyCompiled`, `serializeGeo`, `parseGeo` (сохранив `GeoArrays`, `toArrays`, `buildGeometry`, `b64/unb64`, `compileBlocksCached`):

```ts
export interface ChunkGeo {
  opaqueRaycast: GeoArrays | null
  opaqueNoRaycast: GeoArrays | null
  transparentRaycast: GeoArrays | null
  transparentNoRaycast: GeoArrays | null
}
export interface CompiledMap {
  chunks: ChunkGeo[]
  collider: GeoArrays | null
}

export function compileBlocks(blocks: MapBlock[]): CompiledMap {
  const wedgeGeo = unitWedgeGeometry()
  const wedgeGeoFlip = unitWedgeGeometry(true)
  const b = bucketedBlockGeometries(blocks, wedgeGeo, wedgeGeoFlip)
  const chunks = b.chunks.map(ch => ({
    opaqueRaycast: toArrays(ch.opaqueRaycast),
    opaqueNoRaycast: toArrays(ch.opaqueNoRaycast),
    transparentRaycast: toArrays(ch.transparentRaycast),
    transparentNoRaycast: toArrays(ch.transparentNoRaycast),
  }))
  const collider = toArrays(b.collider)
  for (const ch of b.chunks) { ch.opaqueRaycast?.dispose(); ch.opaqueNoRaycast?.dispose(); ch.transparentRaycast?.dispose(); ch.transparentNoRaycast?.dispose() }
  b.collider?.dispose()
  wedgeGeo.dispose(); wedgeGeoFlip.dispose()
  return { chunks, collider }
}

export function isEmptyCompiled(c: CompiledMap): boolean {
  return c.chunks.length === 0 && !c.collider
}
```

Сериализация (заменить `SerCompiled`/`serializeGeo`/`parseGeo`):

```ts
type SerGeo = { position: string; normal: string; color: string } | null
interface SerChunk { opaqueRaycast: SerGeo; opaqueNoRaycast: SerGeo; transparentRaycast: SerGeo; transparentNoRaycast: SerGeo }
interface SerCompiled { chunks: SerChunk[]; collider: SerGeo }

const serGroup = (a: GeoArrays | null): SerGeo => a && { position: b64(a.position), normal: b64(a.normal), color: b64(a.color) }
const parseGroup = (s: SerGeo): GeoArrays | null => s && { position: unb64(s.position), normal: unb64(s.normal), color: unb64(s.color) }
const serChunk = (c: ChunkGeo): SerChunk => ({ opaqueRaycast: serGroup(c.opaqueRaycast), opaqueNoRaycast: serGroup(c.opaqueNoRaycast), transparentRaycast: serGroup(c.transparentRaycast), transparentNoRaycast: serGroup(c.transparentNoRaycast) })
const parseChunk = (s: SerChunk): ChunkGeo => ({ opaqueRaycast: parseGroup(s.opaqueRaycast), opaqueNoRaycast: parseGroup(s.opaqueNoRaycast), transparentRaycast: parseGroup(s.transparentRaycast), transparentNoRaycast: parseGroup(s.transparentNoRaycast) })

export function serializeGeo(c: CompiledMap): string {
  return JSON.stringify({ chunks: c.chunks.map(serChunk), collider: serGroup(c.collider) } satisfies SerCompiled)
}
/** Parse a loaded geo.json. Old/unknown format (no `chunks`) → empty CompiledMap (consumer falls back to compile). */
export function parseGeo(data: SerCompiled | string): CompiledMap {
  const s = (typeof data === 'string' ? JSON.parse(data) : data) as Partial<SerCompiled>
  if (!Array.isArray(s.chunks)) return { chunks: [], collider: null }
  return { chunks: s.chunks.map(parseChunk), collider: parseGroup(s.collider ?? null) }
}
```

- [ ] **Step 4: Проверка типов и коммит**

Run: `npx tsc -b --noEmit`
Expected: ошибки в `Arena.tsx` (использует старую форму) — ожидаемо, чинится в Task 2. Сам `mapGeometryCache.ts`/`blockGeometry.ts` — без ошибок. Если tsc падает ТОЛЬКО на Arena.tsx — ок, продолжаем; иначе исправить.

```bash
git add src/game/blockGeometry.ts src/game/mapGeometryCache.ts tests/unit/mapChunks.test.ts
git commit -m "feat(perf): чанкованная компиляция геометрии карты (CompiledMap.chunks + collider)"
```

(Коммит допустим при красном Arena.tsx — Task 2 в том же PR чинит; но чтобы не оставлять сборку сломанной между задачами, Task 2 идёт сразу следом.)

---

### Task 2: Arena — рендер по чанкам

**Files:**
- Modify: `src/Arena.tsx`

**Interfaces:**
- Consumes: `CompiledMap { chunks, collider }` (Task 1), `buildGeometry`.

- [ ] **Step 1: geos по чанкам**

Заменить `geos` useMemo и его cleanup:

```tsx
  const geos = useMemo(() => {
    const mk = (a: typeof compiled.collider, bvh: boolean) => {
      const g = a ? buildGeometry(a) : null
      if (g && bvh) g.computeBoundsTree()
      return g
    }
    const chunks = compiled.chunks.map(ch => ({
      opaqueRaycast: mk(ch.opaqueRaycast, true),
      opaqueNoRaycast: mk(ch.opaqueNoRaycast, false),
      transparentRaycast: mk(ch.transparentRaycast, true),
      transparentNoRaycast: mk(ch.transparentNoRaycast, false),
    }))
    return { chunks, collider: mk(compiled.collider, false) }
  }, [compiled])
  useEffect(() => () => {
    for (const ch of geos.chunks) {
      ch.opaqueRaycast?.disposeBoundsTree(); ch.transparentRaycast?.disposeBoundsTree()
      ch.opaqueRaycast?.dispose(); ch.opaqueNoRaycast?.dispose(); ch.transparentRaycast?.dispose(); ch.transparentNoRaycast?.dispose()
    }
    geos.collider?.dispose()
  }, [geos])
```

- [ ] **Step 2: Коллайдер (без изменений) + визуал по чанкам**

Блок коллайдера в JSX оставить как есть (использует `geos.collider`). Заменить четыре `geos.opaqueRaycast && <mesh>…` на цикл по чанкам:

```tsx
      {/* Block visuals per chunk (frustum-culled by three). raycast groups are beam targets (no noRaycast). */}
      {geos.chunks.map((ch, i) => (
        <group key={i}>
          {ch.opaqueRaycast && (
            <mesh geometry={ch.opaqueRaycast} castShadow receiveShadow userData={{ block: true, baseOpacity: 1 }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
              <meshStandardMaterial vertexColors />
            </mesh>
          )}
          {ch.transparentRaycast && (
            <mesh geometry={ch.transparentRaycast} castShadow receiveShadow userData={{ block: true, baseOpacity: BLOCK_TRANSPARENT_OPACITY }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
              <meshStandardMaterial vertexColors transparent opacity={BLOCK_TRANSPARENT_OPACITY} depthWrite={false} />
            </mesh>
          )}
          {ch.opaqueNoRaycast && (
            <mesh geometry={ch.opaqueNoRaycast} castShadow receiveShadow userData={{ noRaycast: true, block: true, baseOpacity: 1 }}>
              <meshStandardMaterial vertexColors />
            </mesh>
          )}
          {ch.transparentNoRaycast && (
            <mesh geometry={ch.transparentNoRaycast} castShadow receiveShadow userData={{ noRaycast: true, block: true, baseOpacity: BLOCK_TRANSPARENT_OPACITY }}>
              <meshStandardMaterial vertexColors transparent opacity={BLOCK_TRANSPARENT_OPACITY} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
```

- [ ] **Step 3: Проверка типов, линт, коммит**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: без ошибок.

```bash
git add src/Arena.tsx
git commit -m "feat(perf): Arena рендерит геометрию карты по чанкам (frustum culling)"
```

---

### Task 3: dev-эндпоинт пересборки geo.json + пересборка стабильных карт

**Files:**
- Modify: `build/vite-plugins/editorMaps.ts`

**Interfaces:**
- Consumes: `compileBlocks`, `serializeGeo` из `src/game/mapGeometryCache.ts` (через `server.ssrLoadModule`).

- [ ] **Step 1: Эндпоинт `/__recompile`**

В `configureServer(server)` (в `editorMaps.ts`), рядом с существующим `server.middlewares.use('/__maps', …)`, добавить:

```ts
      // Dev-only: recompile every map's geo.json from its raw.json via the real compile pipeline
      // (ssrLoadModule). Used to regenerate all maps into the current geo format ahead of time.
      server.middlewares.use('/__recompile', async (_req, res) => {
        try {
          const mod = await server.ssrLoadModule('/src/game/mapGeometryCache.ts') as {
            compileBlocks: (blocks: unknown[]) => unknown
            serializeGeo: (c: unknown) => string
          }
          await fs.mkdir(MAPS_DIR, { recursive: true })
          const entries = await fs.readdir(MAPS_DIR, { withFileTypes: true })
          const done: string[] = []
          for (const e of entries) {
            if (!e.isDirectory()) continue
            const raw = await fs.readFile(path.join(MAPS_DIR, e.name, 'raw.json'), 'utf8').catch(() => null)
            if (raw == null) continue
            const map = JSON.parse(raw) as { blocks: unknown[] }
            await fs.writeFile(path.join(MAPS_DIR, e.name, 'geo.json'), mod.serializeGeo(mod.compileBlocks(map.blocks)), 'utf8')
            done.push(e.name)
          }
          return sendJson(res, 200, { recompiled: done })
        } catch (err) {
          return sendJson(res, 500, { error: String(err) })
        }
      })
```

- [ ] **Step 2: tsc**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Пересобрать geo.json стабильных карт (headless)**

Поднять dev-сервер в фоне, дёрнуть эндпоинт, погасить:

```bash
(npm run dev > "$TMPDIR/dev.log" 2>&1 &) ; sleep 10
curl -s --max-time 60 http://localhost:5173/__recompile ; echo
pkill -f vite ; pkill -f rolldown
```

Ожидаемо: `{"recompiled":[...все карты...]}`. geo.json перезаписаны в новом формате.

- [ ] **Step 4: Коммит эндпоинта + geo стабильных карт (НЕ os_test)**

```bash
git add build/vite-plugins/editorMaps.ts \
  src/maps/os_arena/geo.json src/maps/os_india/geo.json src/maps/os_pillars/geo.json src/maps/os_pool_day/geo.json
git commit -m "feat(perf): dev-эндпоинт /__recompile + пересборка geo.json стабильных карт в чанк-формат"
```

(os_test/geo.json — живой файл пользователя, не коммитим; его редактор пересоберёт при следующем сейве.)

---

### Task 4: changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1:** В `## [1.1.0]` → `### Fixed` добавить:

```markdown
- **Large maps render fast.** Map geometry is split into spatial chunks so the GPU skips off-screen parts in
  every pass (color, shadows, outline) — heavy maps no longer tank the frame rate.
```

- [ ] **Step 2:**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog — чанкинг геометрии карты"
```
