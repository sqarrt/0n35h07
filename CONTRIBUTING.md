# Contributing to OneShot

Thanks for taking the time to contribute! This project is a hobby game, but the codebase is held to a real standard — please skim this before opening a PR.

> The codebase and its comments are in English. The older commit history is in Russian (the project grew up Russian-first). PRs and issues in **English or Russian** are both fine.

## Getting set up

Requirements: **Node `^20.19` or `>=22.12`** (Vite 8 / Rolldown / Vitest need an even, LTS-ish Node), plus the Rust toolchain only if you touch the Tauri desktop build.

```bash
git clone https://github.com/sqarrt/0n35h07.git
cd 0n35h07
npm install
npm run dev          # http://localhost:5173
```

For online / Tauri work see the [README](./README.md).

## Workflow

1. **Fork** the repo and create a topic branch off `master` (`feat/...`, `fix/...`, `docs/...`).
2. Make focused changes — one logical change per PR.
3. Keep the **test gate green** (see below) and update / add tests for your change.
4. Update `CHANGELOG.md` if the change is user-visible.
5. Open a PR against `master`. Fill in the PR template; link any related issue.

> The maintainer uses an internal release-branch flow (`release_x.y.z`) for cutting versions — as a contributor you don't need to worry about it; just target `master`.

## The test gate (mandatory)

The canonical run must pass before a PR is merged:

```bash
npm run lint                 # ESLint, no warnings
npx tsc -b --noEmit          # full type-check
npm run test                 # Vitest (unit) + Playwright headless (e2e)
```

Rules of the road for tests:

- **No flaky tests.** If a test can't be stabilised, raise it in the PR rather than papering over it with arbitrary timeouts.
- Rapier (WASM) and the R3F renderer don't run in jsdom, so **physics / movement / collisions / in-browser networking are tested in e2e** (`tests/*.spec.ts`, real Chromium). Pure logic lives in unit tests (`tests/unit/*.test.ts`).
- A single test: `npx vitest run --config vitest.config.ts -t "name"` or `npx playwright test --project=headless -g "substring"`.

Watching e2e run live (optional): launch a debuggable Chrome and use the `connected` project.

```bash
# Windows example:
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:/tmp/chrome-debugging"
npm run test:connected
```

## Code style (non-negotiable bits)

These are enforced by review:

- **SOLID, DRY, SRP.** The architecture leans on dependency inversion (`Player` composes injected `Body` / `IWeapon` / `IShield`); keep new code in that spirit.
- **No magic numbers.** Use named constants. Keep constants **local**: used in one file → declare there; used across a directory → at the directory level; project-wide → `src/constants`.
- **`erasableSyntaxOnly` is on:** no `enum`, no `namespace`, no constructor parameter-properties (`constructor(private x)`). Declare fields explicitly and assign in the body.
- **Don't make the UI "jump":** element sizes and positions must stay stable across state changes.
- Match the surrounding code — comment density, naming and idiom. Write new comments in English.

## Commit messages

Conventional-commits style, matching the existing history:

```
feat(bot): near-miss aim + per-bot fire rate
fix(combat): third-person hit uses the camera aim ray, not the muzzle
docs(changelog): ...
```

Subject in imperative mood; a body explaining the *why* is appreciated for non-trivial changes.

## Licensing of contributions

By submitting a contribution you agree to license your code under the project's **AGPL-3.0** and any assets you add under **CC BY-SA 4.0** (see [README → License](./README.md#license)). Only contribute assets you have the right to license this way.

Questions? Open a [discussion or issue](https://github.com/sqarrt/0n35h07/issues). Thanks! 🎯
