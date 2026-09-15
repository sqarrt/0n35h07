<!-- Thanks for contributing! Keep PRs focused — one logical change each. -->

## What & why

<!-- What does this change, and why? Link any related issue: Closes #123 -->

## How to test

<!-- Steps a reviewer can follow to see it working. -->

## Checklist

- [ ] The GUT suite passes (`godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit`) — no flaky tests introduced
- [ ] Tests added / updated for this change
- [ ] If the radio page changed: `npm run typecheck`, `npm test` and `npm run build` in `radio-host/`, rebuilt bundle committed
- [ ] No magic numbers; constants kept local (per [CONTRIBUTING](../CONTRIBUTING.md))
- [ ] In `radio-host/` TypeScript: no `enum` / `namespace` / parameter-properties (`erasableSyntaxOnly`)
- [ ] `CHANGELOG.md` updated (if user-visible)
- [ ] Any new assets are mine to license under CC BY-SA 4.0
