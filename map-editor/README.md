# 0N35H07 · map editor

The map editor of the original web game, kept as a **dev tool**: its own web app, run from this folder, writing
straight into the Godot project's map files. It never ships with the game.

```bash
cd map-editor
npm ci          # first time (or after the lockfile changes)
npm run dev     # → http://localhost:5173/
```

The page routes on the hash: `#` (or `#editor`) is the map picker, `#editor-<id>` opens that map.

## What it writes

Saving a map writes the three files the game reads, in place:

| editor artifact | file in the game |
|---|---|
| source map | `maps/<id>.json` — `nodes/map_files.gd`, `sim/block_grid.gd`, `sim/spawns.gd` |
| compiled geometry | `maps/<id>_geo.json` — `nodes/geo_loader.gd` (render chunks + the movement collider) |
| preview | `assets/maps/previews/<id>.png` — the lobby's map tiles and background |

The REVERT copy taken when a map is opened stays out of the game, in `map-editor/.backups/<id>.json`.

The lobby's list of maps (`MAP_IDS` in `sim/map_catalog.gd`) is kept in step for you: creating a map appends it,
renaming it renames it in place, deleting it takes it out. Renaming moves all three files at once — a map whose
geometry was left behind would not open in the game at all.

`GET http://localhost:5173/__recompile` rebuilds every map's perimeter walls and geometry through the current
compiler — use it after changing `src/game/mapGeometryCache.ts` or `perimeter()`.

## Controls

Click the canvas to take the mouse. `WASD` + `Space` move, `Tab` switches walk (gravity, autostep, collisions —
the match's own constants) and fly. Crosshair: left click places, right click removes.

`1` cube · `2` wedge · `3` host spawn · `4` guest spawn · `5` select.
`R` turns a wedge (or a held selection), `T` flips it, `G` lays it on its side, `L` shows the cell edges.
With SELECT: click two corners, then `C` copy, `X` cut, `Delete` erase, `V` paste (left click stamps, right cancels).

The side panel holds the arena size, the floor and wall colours, the in-game cube grid toggle, SAVE and REVERT.
Edits autosave three seconds after the last one.

## Checks

```bash
npm run typecheck
npm test        # the editor's model, the selection/clipboard, the geo format, the constants shared with the game
```

`tests/unit/constants.test.ts` reads `sim/constants.gd` and `sim/block_grid.gd` and fails if the editor's copy of a
shared number drifts from the game's. `tests/unit/geoFormat.test.ts` pins the shape `nodes/geo_loader.gd` parses.

## Provenance

Restored from the web game (`git show 4a91a4a^:web-reference/src/editor/...`). The geometry compiler
(`src/game/mapGeometryCache.ts`) is kept **byte-for-byte** — it defines the format the Godot loader reads. The parts
that only made sense inside the web game are gone: the map registry, the player profile, the UI sounds and the
localisation.
