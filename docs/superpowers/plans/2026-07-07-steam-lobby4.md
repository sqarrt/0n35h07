# steam-lobby4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Steam-лобби до 4 игроков: поднять Rust-cap (2→4), дать хосту приглашать НЕСКОЛЬКИХ друзей из 2v2/FFA-сетки (стадия 2 Steam-интеграции для мультислота), починить много-гостевое лобби (уход гостя не должен выбивать других гостей).

**Architecture:** Rust-транспорт и SteamNet уже пир-агностичны (точечный send по SteamId, membership из колбэков лобби) — меняется одна константа и комментарии. Реальная работа в UI: единственный `invited`-стейт (1v1) обобщается в список инвайтов; `LobbySeatsGrid` получает invite-CTA на пустых сиденьях Steam-friend-вкладки (клик = пригласить, угловая 🤖-кнопка = бот) и «ждём»-сиденья с ✕. Плюс корректность: клиент комнаты закрывается только при уходе ХОСТА (peerId хоста запоминается из Assign).

**Tech Stack:** Rust (steamworks-rs 0.11, только константа/комменты), TypeScript/React, Vitest (+testing-library для компонентов), cargo check в WSL.

**Спека:** `docs/superpowers/specs/2026-07-07-multiplayer-4p-mesh-design.md` §11 ветка 4. Отчёт: `docs/STEAM_0.5.10_REPORT.md` §4 (стадия 2).

## Global Constraints

- Ветка `feature/steam-lobby4` от `release_1.1.0`; не пушить; мерж после одобрения.
- Полный `npm run test` — только в финальном чекпоинте после подтверждения пользователя.
- Rust: НЕ трогать воркэраунды accept()/forget (steam_net.rs:173-189) и end_reason()/transmute (:193-199); дисциплина «колбэки только enqueue» (:96-100). Верификация: `cargo check --manifest-path src-tauri/Cargo.toml` (Steam-рантайм не нужен).
- Steam-путь в e2e не гоняется (нет Steam в CI/WSL) — покрытие юнитами и компонентными тестами; живой smoke на 2 ПК — после мержа, до релиза (уже в памяти).
- Вне scope: SteamQuickMatch (квик-матч остаётся парным, спека §12), DualMatchmaker/createNet (web-only), визуальный редизайн лобби (frontend-design).

---

### Task 1: Rust cap 2→4 + комментарии транспорта

**Files:**
- Modify: `src-tauri/src/steam_net.rs` (:24 константа; комменты :3-5, :178, :250, :270, :276)
- Modify: `src/net/SteamNet.ts` (:20 устаревший «1v1»-докстринг)

**Steps:**
- [ ] Ветка: `git checkout release_1.1.0 && git checkout -b feature/steam-lobby4`.
- [ ] `LOBBY_MAX_MEMBERS: u32 = 2` → `4` с комментом `// mesh: up to 4 players (2v2 / FFA)`.
- [ ] Обновить шапку файла (:3-5 «max 2 … between the two SteamIDs» → меш до 4, точечные сообщения по SteamId), докстринги :250/:270/:276 («1v1 lobby» → «lobby (up to LOBBY_MAX_MEMBERS)»), и комментарий у accept-воркэраунда (:178): «leaks one Arc per accepted session — up to 3 per peer in a 4-player lobby, still negligible».
- [ ] `SteamNet.ts:20`: докстринг «1v1 → broadcast == send to the single peer» → «mesh: broadcast fans out to every lobby member (point-to-point Steam messages)».
- [ ] Verify: `cargo check --manifest-path src-tauri/Cargo.toml` чист; `npx vitest run --config vitest.config.ts tests/unit/SteamNet.test.ts` PASS.
- [ ] Commit: `feat(steam): лобби до 4 игроков — cap и комментарии транспорта`.

---

### Task 2: Клиент комнаты переживает уход другого гостя (hostPeer из Assign)

Сейчас `RoomSession` (клиент) на ЛЮБОЙ `onPeerLeave` зовёт `onHostGone` → все гости вылетают из лобби, когда уходит один. В паре это было верно (единственный пир = хост), в меш-лобби — баг.

**Files:**
- Modify: `src/net/RoomSession.ts` (клиентский конструктор: `net.on('assign', (payload, from) => …)` — запомнить `hostPeer`; `onPeerLeave` — фильтр)
- Test: `tests/unit/RoomSession.test.ts`

**Interfaces:**
- Produces: приватное поле `hostPeer: PeerId | null` (клиент); правило: до Assign любой уход = кандидат-хост ушёл (поведение пары сохраняется); после Assign закрываемся ТОЛЬКО на уходе `hostPeer`.

**Steps (TDD):**
- [ ] Падающий тест (LoopbackHub из 3: host H + гости B, C — гости строятся как 'client' на общем хабе):

```ts
describe('RoomSession — много-гостевое лобби', () => {
  it('уход ДРУГОГО гостя не закрывает комнату у клиента; уход хоста — закрывает', () => {
    const [h, b, c] = createLoopbackHub(['H', 'B', 'C'])
    const host = new RoomSession(h, 'host', 'AB12', HOST)
    host.setMode('ffa')
    const gb = new RoomSession(b, 'client', 'AB12', GUEST)
    const gc = new RoomSession(c, 'client', 'AB12', { ...GUEST, name: 'Guest2' })
    let closedB = 0
    gb.onClosed(() => { closedB++ })
    expect(gb.view().connected).toBe(true)
    expect(gc.view().connected).toBe(true)
    b.triggerLeave('C')          // у гостя B исчез гость C
    expect(closedB).toBe(0)      // комната жива
    b.triggerLeave('H')          // ушёл хост
    expect(closedB).toBe(1)
  })
})
```
(Проверить существующий hello-путь на хабе: оба гостя шлют hello broadcast — host сажает обоих; ретраи в loopback синхронны. Если гость получает чужой Assign (broadcast? — нет, Assign адресный send ✓) — ок.)
- [ ] FAIL → реализация: поле `hostPeer`, `onAssign` получает `from` (изменить подписку на `(payload, from) => this.onAssign(payload as Assign, from)`), `onPeerLeave`-клиент: `if (this.localPlayerId >= 0 && this.hostPeer !== null && peer !== this.hostPeer) return; this.onHostGone()`.
- [ ] Прогнать RoomSession + NetSession юниты → PASS → Commit: `fix(room): уход другого гостя больше не выбивает клиента из лобби — хост-пир из Assign`.

---

### Task 3: Инвайты списком + invite-CTA в LobbySeatsGrid

**Files:**
- Modify: `src/screens/Lobby.tsx` (:52 `invited` single → список; проводка в grid-ветку :112-119)
- Modify: `src/components/lobby/LobbySeatsGrid.tsx` (invite-CTA / waiting-сиденья / угловая бот-кнопка)
- Modify: `src/components/lobby/types.ts` (тип PendingInvite)
- Modify: `src/App.tsx` `buildLobby` (прокинуть `seatedPeerIds` из `session.netConfig().owners` для прюнинга)
- Test: Create `tests/unit/LobbySeatsGrid.test.tsx` (по образцу SteamFriendPicker.test.tsx)

**Interfaces:**
- `types.ts`: `export interface PendingInvite { id: string; name: string }`.
- `LobbySeatsGrid` props += `invite?: { pending: PendingInvite[]; onInvite: () => void; onCancel: (id: string) => void }` — присутствует ТОЛЬКО на Steam-friend-вкладке у хоста; отсутствует → поведение как сейчас (web/bot-вкладки не меняются).
- Рендер пустых сидений при `invite`:
  - первые `pending.length` пустых сидений → waiting-вид (`lobby-seat--waiting`, имя друга, ✕ `lobby-invite-cancel-${slot}` → `onCancel(id)`);
  - остальные пустые → CTA «＋ {t.lobbyInviteSection}» (клик → `onInvite()`, открывает существующий SteamFriendPicker) + угловая кнопка `lobby-seat-bot-${slot}` (🤖, клик → `onSeatClick(slot)` = добавить бота, stopPropagation).
- `Lobby.tsx`: state `invites: PendingInvite[]`; 1v1-ветка использует `invites[0] ?? null` (текущий `InviteSeatCfg` не меняется); grid-ветка собирает `invite`-проп. Прюнинг:
  - decline: существующий `onSteamInviteDeclined` (:60-66) → `setInvites(prev => prev.filter(i => i.id !== declinerId))`;
  - accept: эффект на `seatedPeerIds` (новый проп из App: `Object.values(session.netConfig().owners)`) → выкинуть инвайты, чей `id` уже сидит;
  - смена вкладки (:57) → очистить список (как сейчас).
- `SteamFriendPicker.onPick` → `setInvites(prev => [...prev, { id, name }])` + `steamInviteToFriend` (существующий вызов); повторный инвайт того же id — no-op (guard).

**Steps (TDD):**
- [ ] Падающие компонентные тесты `LobbySeatsGrid.test.tsx` (jsdom, как SteamFriendPicker.test.tsx; SfxContext/i18n-провайдеры по образцу существующих UI-тестов):
  1. без `invite`-пропа пустое сиденье — глиф `—` (регрессия web-пути);
  2. с `invite` и pending=[] — пустое сиденье показывает CTA-текст и кнопку `lobby-seat-bot-2`;
  3. клик по CTA зовёт `onInvite`; клик по 🤖 зовёт `onSeatClick(slot)` и НЕ зовёт `onInvite`;
  4. pending=[{id,name:'Sanya'}] — первое пустое сиденье в waiting-виде с именем и ✕; ✕ зовёт `onCancel('id')`;
  5. занятые сиденья рендерятся как раньше (имя, data-mine).
- [ ] FAIL → реализация grid + Lobby + App-проводка.
- [ ] Прогнать `LobbySeatsGrid.test.tsx`, `SteamFriendPicker.test.tsx`, `Appearance.test.tsx`, `tsc`, `lint` → PASS.
- [ ] Commit: `feat(steam): инвайты нескольких друзей из 2v2/FFA-сетки — список ожиданий, CTA на пустых сиденьях`.

---

### Task 4: Финальная верификация + чекпоинт

- [ ] `grep -rn "strict 1v1\|max 2" src-tauri/src/ src/net/SteamNet.ts` → пусто/обновлено.
- [ ] `cargo check`; `npx tsc -b --noEmit`; `npm run lint`; `npm run test:unit` → PASS.
- [ ] E2e смоук затронутого web-пути: `npx playwright test --project=headless tests/lobby-modes.spec.ts tests/room.spec.ts tests/mesh.spec.ts` (grid-рендер без invite-пропа не должен дрогнуть).
- [ ] **ЧЕКПОИНТ — доклад пользователю**; полный `npm run test` после подтверждения; CHANGELOG (Added: «Steam lobby fits four — invite several friends straight from the 2v2/FFA seats»); мерж в `release_1.1.0` по команде.
- [ ] Напомнить: живой Steam-smoke (2 ПК, 2 аккаунта): инвайт из сетки, авто-join, 3-4 участника, уход гостя из лобби.

## Заметки исполнителю

- Steam-события в юнитах не мокаются глубже, чем сейчас (steam.ts soft-fail off-desktop) — компонентные тесты дергают коллбеки напрямую.
- `steam_invite_to_lobby` лобби-скоуп (не сиденье-скоуп) — несколько инвайтов подряд валидны без правок Rust.
- Waiting-сиденья — ВИЗУАЛЬНАЯ проекция списка на первые пустые места: друг, приняв инвайт, займёт первый свободный слот по HELLO — это ок (слоты не бронируются).
- `invited` guard в 1v1-ветке (`useEffect` на `opponent`, Lobby.tsx:55) — заменить на общий прюнинг-эффект, не плодить два механизма.
