# Dash — дизайн

## Context

Пункт TODO: добавить рывок (dash) на Shift. Это аркадная механика мобильности поверх уже
существующего движения на Rapier KinematicCharacterController. Цель — резкий короткий бросок в
направлении ввода, с кулдауном и реакцией FOV, дополнительно служащий способом отменить
заряженный выстрел.

Стек уже на месте: движение — `HumanController` (намерение от WASD относительно камеры) →
`Body.move` (копит `desired`) → `Match.applyPhysics` (KCC: `computeColliderMovement` →
`setNextKinematicTranslation`). FOV — `HumanController.lateUpdate`. Кулдауны intent-методов —
вшиты в объекты (как `startFiring`/`activateShield`).

## Поведение

- **Триггер:** `Shift` **при зажатом WASD** → бросок ~0.15с в направлении WASD (горизонтально,
  относительно камеры). **Стоя на месте (нет WASD) — рывок не срабатывает и кулдаун не тратится.**
- **Движение:** фикс. длительность `DASH_DURATION` на скорости `DASH_SPEED` (~3× обычной).
  Дистанция ≈ `DASH_SPEED · DASH_DURATION`. Только горизонталь; работает и в воздухе (гравитация
  идёт своим чередом). Стены/боты честно останавливают рывок (KCC, без прохода сквозь).
- **Кулдаун:** `DASH_COOLDOWN`. Пока не остыл — Shift игнорируется.
- **FOV:** на время рывка целевой FOV подскакивает до `DASH_FOV`, затем возвращается обычной
  лерп-логикой.
- **Отмена заряда:** если рывок **успешно стартовал** во время windup выстрела — заряд
  отменяется, оружие уходит в **cooldown** (выстрел НЕ производится). Это единственный способ
  прервать заряженный выстрел. Если рывок не стартовал (кулдаун рывка / нет WASD) — заряд не
  трогается. Рывок естественно снимает и windup-замедление движения (windup закончился).

## Архитектура (в духе проекта: объекты владеют поведением, контроллеры дёргают intent-методы)

- **`Player.dash(dir: THREE.Vector3)`** — intent-метод с вшитым кулдауном:
  - `if (dir.lengthSq() === 0) return` (нет направления — нет рывка);
  - `if (!this.body.dash(dir)) return` (`Body.dash` вернул `false` → кулдаун, выходим);
  - `this.weapon.interrupt()` (рывок стартовал → отменить заряд, если он шёл).
- **`Body`** владеет состоянием рывка (он же владеет движением):
  - поля: `dashDir: Vector3`, `dashTimer = 0` (мс), `dashCooldown = 0` (мс);
  - `dash(dir): boolean` — если `dashCooldown <= 0` → `dashDir = dir.normalize()`,
    `dashTimer = DASH_DURATION`, `dashCooldown = DASH_COOLDOWN`, вернуть `true`; иначе `false`;
  - `stepDash(dt)` (зовётся из `Match.applyPhysics` рядом со `stepVertical`): `dashCooldown -= dt·1000`;
    если `dashTimer > 0` → `desired += dashDir · DASH_SPEED · dt`, `dashTimer -= dt·1000`;
  - геттер `dashing` (= `dashTimer > 0`) — для FOV;
  - `setPosition`/`reset` на респавне сбрасывают рывок и кулдаун.
- **`IWeapon.interrupt()`** (+ реализация в `BeamWeapon`): если `phase === 'windup'` →
  `phase = 'cooldown'`, `cooldownRemaining = cooldownDuration`, `windupElapsed = 0` (без выстрела,
  без `justFired`). No-op в прочих фазах. (У ботов метод есть, но они рывок не делают.)
- **`HumanController.onDash()`** (Shift): вычисляет WASD-направление от камеры (та же логика, что в
  `update` для движения); если ненулевое → `player.dash(dir)`. В `lateUpdate` целевой FOV:
  `player.dashing ? DASH_FOV : <текущая логика>`. Gating по pointer-lock — как у `onFire`/`onShield`.
- **`Game.tsx`**: `keydown` `ShiftLeft`/`ShiftRight` → `hc.onDash()`.
- **`Match.applyPhysics`**: на игрока вызвать `stepDash(dt)` (до/после `stepVertical`, оба копят в
  `desired`, порядок не важен).
- **`constants.ts`**: `DASH_SPEED` (ед/с, ~3× `MOVE_SPEED`), `DASH_DURATION` (мс, ~150),
  `DASH_COOLDOWN` (мс, ~1500), `DASH_FOV` (~95).

## Edge cases

- Рывок на кулдауне → Shift без эффекта, заряд не отменяется.
- Shift без WASD → без эффекта, кулдаун не тратится.
- Рывок в стену → KCC останавливает (дистанция меньше, без прохода).
- Респавн во время рывка → рывок и кулдаун сбрасываются.
- Боты `dash` не вызывают (метод доступен, но не используется).

## Testing

- **Юнит (без Rapier):**
  - `Body`: `dash(dir)` стартует только если кулдаун готов и `dir≠0`; `stepDash` копит в `desired`
    пока `dashTimer>0`; повтор во время кулдауна → `false`/нет добавки; `dashing` отражает окно.
  - `Player.dash`: делегирует в `Body`; при успешном рывке зовёт `weapon.interrupt()`; на кулдауне
    рывка — `interrupt` не зовётся.
  - `BeamWeapon.interrupt`: из windup → cooldown без `justFired`; вне windup — no-op.
- **E2E (Chromium):** `Shift+W` даёт больший сдвиг по Z, чем просто `W` за то же время; `Shift`
  стоя — позиция не меняется; повторный `Shift` сразу — без второго рывка; (опц.) рывок во время
  заряда → `__debugWindup` становится `false`.

## Out of scope

- Звук/партиклы рывка, двойной-тап как альтернативный триггер, рывок для ботов.
