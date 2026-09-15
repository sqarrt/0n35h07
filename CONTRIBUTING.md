# Contributing to 0N35H07

Thanks for taking the time to contribute! This project is a hobby game, but the codebase is held to a real standard —
please skim this before opening a PR.

> The codebase and its comments are in English. The older commit history is in Russian (the project grew up
> Russian-first). PRs and issues in **English or Russian** are both fine.

## Getting set up

Requirements: **Godot 4.7.1** (standard build); **Node `^20.19` or `>=22.12`** only if you touch the radio page in
`radio-host/`.

```bash
git clone https://github.com/sqarrt/0n35h07.git
cd 0n35h07
godot --headless --path . --import     # once, and after adding class_name scripts
```

Then open `project.godot` in the Godot editor. See the [README](./README.md) for the Windows build and Steam.

## Workflow

1. **Fork** the repo and create a topic branch off `master` (`feat/...`, `fix/...`, `docs/...`).
2. Make focused changes — one logical change per PR.
3. Keep the **test gate green** (see below) and update / add tests for your change.
4. Update `CHANGELOG.md` if the change is user-visible.
5. Open a PR against `master`. Fill in the PR template; link any related issue.

> The maintainer uses an internal release-branch flow (`release_x.y.z`) for cutting versions — as a contributor you
> don't need to worry about it; just target `master`.

## The test gate (mandatory)

The GUT suite must pass before a PR is merged:

```bash
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit
# one script: add -gselect=test_match_rules
```

If you change the radio page:

```bash
cd radio-host && npm ci && npm run typecheck && npm test && npm run build   # commit the rebuilt localhost/radio_host
```

Rules of the road for tests:

- **No flaky tests.** If a test can't be stabilised, raise it in the PR rather than papering over it with arbitrary
  waits.
- Pure logic lives in `sim/` and is tested by constructing its classes directly; nodes are tested inside a
  `SubViewport`, networking over `LoopbackNet` peers, Steam against the fake API in `tests/unit/fake_steam_api.gd`.

## Code style (non-negotiable bits)

These are enforced by review:

- **SOLID, DRY, SRP.** A `Player` composes its body, weapon and shield; controllers drive the same intents; the rules live
  in one place. Keep new code in that spirit.
- **No magic numbers.** Use named constants. Keep constants **local**: used in one file → declare there; used across a
  directory → at the directory level; project-wide → `sim/constants.gd`.
- **Typed GDScript** where the type is known; static helpers over singletons where state isn't needed.
- **Don't make the UI "jump":** element sizes and positions must stay stable across state changes.
- In `radio-host/` TypeScript, `erasableSyntaxOnly` is on: no `enum`, no `namespace`, no constructor
  parameter-properties.
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

By submitting a contribution you agree to license your code under the project's **AGPL-3.0** and any assets you add
under **CC BY-SA 4.0** (see [README → License](./README.md#license)). Only contribute assets you have the right to
license this way.

Questions? Open a [discussion or issue](https://github.com/sqarrt/0n35h07/issues). Thanks! 🎯
