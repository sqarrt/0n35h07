# Editor Perf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Сделать редактирование большой карты отзывчивым: клинья через InstancedMesh (вместо 2620 мешей), edge-сетка строится только когда включена.

**Architecture:** Всё в `src/editor/EditorScene.tsx`. Новый хук `useWedgeMeshes` (по образцу `useCubeMeshes`), `pick()` резолвит ячейку клина через instanceId, `useEdgesGeometry` ленив. Спека: `docs/superpowers/specs/2026-07-11-editor-perf-design.md`.

**Tech Stack:** TypeScript, Three.js, React Three Fiber.

## Global Constraints

- Ветка `feature/map-perf-chunks`; после задачи `npx tsc -b --noEmit` + `npm run lint`; тесты — пользователь.
- Общие `wedgeGeo`/`wedgeGeoFlip` НЕ диспозить при пересборке (создаются один раз); диспозить только материалы инстанс-мешей.
- Файлы `src/maps/os_test/*` не трогать.

---

### Task 1: инстансы клиньев + ленивая сетка

**Files:** Modify `src/editor/EditorScene.tsx`

- [ ] **Step 1: Ленивая `useEdgesGeometry`**

Заменить:
```ts
function useEdgesGeometry(voxels: Map<string, Cell>, enabled: boolean): THREE.BufferGeometry | null {
  return useMemo(() => (enabled ? cellsGridGeometry([...voxels.keys()].map(parseCellKey)) : null), [voxels, enabled])
}
```

- [ ] **Step 2: Хук `useWedgeMeshes` вместо `ShapeMeshes`**

Удалить компонент `ShapeMeshes`, добавить (рядом с `useCubeMeshes`):
```ts
/** Instanced wedge meshes (non-cube cells): geometry (normal/flip) × transparency. Per-instance matrix
 *  (wedgeQuaternion) + color. Each mesh carries userData.wedgeCellKeys (instanceId → cell key) for raycast. */
function useWedgeMeshes(voxels: Map<string, Cell>, wedgeGeo: THREE.BufferGeometry, wedgeGeoFlip: THREE.BufferGeometry): THREE.InstancedMesh[] {
  return useMemo(() => {
    const groups = [
      { geo: wedgeGeo, transparent: false, cells: [] as [string, Cell][] },
      { geo: wedgeGeo, transparent: true, cells: [] as [string, Cell][] },
      { geo: wedgeGeoFlip, transparent: false, cells: [] as [string, Cell][] },
      { geo: wedgeGeoFlip, transparent: true, cells: [] as [string, Cell][] },
    ]
    for (const [k, cell] of voxels) {
      if (cell.t === 'cube') continue
      const useFlip = !cell.s && cell.f
      groups[(useFlip ? 2 : 0) + (cell.tr ? 1 : 0)].cells.push([k, cell])
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3()
    const s = new THREE.Vector3(VOXEL, VOXEL, VOXEL), col = new THREE.Color()
    const meshes: THREE.InstancedMesh[] = []
    for (const g of groups) {
      if (!g.cells.length) continue
      const mat = new THREE.MeshStandardMaterial(g.transparent ? { transparent: true, opacity: BLOCK_TRANSPARENT_OPACITY, depthWrite: false } : {})
      const mesh = new THREE.InstancedMesh(g.geo, mat, g.cells.length)
      mesh.layers.enable(BLOCK_LAYER)
      const wedgeCellKeys: string[] = []
      let i = 0
      for (const [k, cell] of g.cells) {
        const [x, y, z] = parseCellKey(k)
        p.set(...cellCenter(x, y, z))
        wedgeQuaternion(cell.d, cell.s === true, q)
        m.compose(p, q, s)
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, col.set(cell.c))
        wedgeCellKeys.push(k)
        i++
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.editorTarget = true
      mesh.userData.wedgeCellKeys = wedgeCellKeys
      meshes.push(mesh)
    }
    return meshes
  }, [voxels, wedgeGeo, wedgeGeoFlip])
}
```

- [ ] **Step 3: Подключить хуки в `EditorScene`**

Рядом с `const cubeMeshes = useCubeMeshes(voxels)` и его cleanup:
```ts
  const wedgeMeshes = useWedgeMeshes(voxels, wedgeGeo, wedgeGeoFlip)
  useEffect(() => () => { for (const mesh of wedgeMeshes) (mesh.material as THREE.Material).dispose() }, [wedgeMeshes])
```
(строки `wedgeGeo`/`wedgeGeoFlip` уже объявлены выше по коду — хук идёт после них.)

`edgesGeo`: заменить вызов на `const edgesGeo = useEdgesGeometry(voxels, showCubeGrid)` и cleanup на `useEffect(() => () => edgesGeo?.dispose(), [edgesGeo])`.

- [ ] **Step 4: `pick()` — ячейка клина через instanceId**

В `pick()` заменить `const key = hit.object.userData.cellKey` на:
```ts
    const ud = hit.object.userData
    const key = (ud.wedgeCellKeys && typeof hit.instanceId === 'number') ? (ud.wedgeCellKeys as string[])[hit.instanceId] : ud.cellKey
```
(остальная ветка `if (typeof key === 'string')` не меняется.)

- [ ] **Step 5: JSX**

Заменить `<ShapeMeshes voxels={voxels} wedgeGeo={wedgeGeo} wedgeGeoFlip={wedgeGeoFlip} />` на:
```tsx
      {wedgeMeshes.map((mesh, i) => <primitive key={i} object={mesh} />)}
```
Заменить блок сетки `<lineSegments geometry={edgesGeo} visible={showCubeGrid}>…</lineSegments>` на условный:
```tsx
      {edgesGeo && (
        <lineSegments geometry={edgesGeo}>
          <lineBasicMaterial color={BLOCK_GRID_COLOR} transparent opacity={BLOCK_GRID_OPACITY} />
        </lineSegments>
      )}
```

- [ ] **Step 6: tsc + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: без ошибок. (Если `wedgeEuler` больше не используется после удаления `ShapeMeshes` — убрать из импорта `../game/wedge`.)

- [ ] **Step 7: Ручная проверка пользователем**

- клинья (обычные/flip/on-side/прозрачные) рисуются и ориентированы верно; ставятся/удаляются по прицелу;
- редактирование большой карты заметно отзывчивее; сетка (L) строится только включённой;
- кубы, спавны, выделение/вставка не сломаны.

- [ ] **Step 8: Commit**

```bash
git add src/editor/EditorScene.tsx
git commit -m "perf(editor): инстансы клиньев + ленивая edge-сетка — отзывчивое редактирование больших карт"
```

---

### Task 2: changelog

- [ ] **Step 1:** В `CHANGELOG.md` → `## [1.1.0]` → `### Fixed`:
```markdown
- **Map editor stays responsive on large maps.** Wedges are drawn with instancing instead of thousands of
  separate meshes, and the cell-edge grid is built only when shown — editing a big map no longer stutters.
```
- [ ] **Step 2:** `git add CHANGELOG.md && git commit -m "docs: changelog — перф редактора (инстансы клиньев, ленивая сетка)"`
