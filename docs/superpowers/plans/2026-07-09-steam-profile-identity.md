# Steam-Bound Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Профиль привязан к Steam-аккаунту: первый раз для аккаунта — имя из Steam; далее — настройки из его облака; смена аккаунта не показывает и не заливает чужие данные; существующие установки не страдают.

**Architecture:** Чистая `decideProfileSyncForUser` (ядро — прежний `decideProfileSync`) + тег владельца `oneshot:profile:owner` + сидинг имени в `syncProfileOnStartup`. App упрощается. Спека: `docs/superpowers/specs/2026-07-09-steam-profile-identity-design.md`.

## Global Constraints

- Ветка `feature/steam-profile-identity`; коммит после каждой задачи; после каждой `npx tsc -b --noEmit`, в финале `npm run lint`. vitest/playwright — пользователь.
- Desktop-only логика; браузер не меняется. `settings.ts` платформо-независим.

---

### Task 1: settings.ts — экспорт randomProfile

- [ ] **Step 1:** В `src/settings.ts:51` заменить `function randomProfile(): PlayerProfile {` на `export function randomProfile(): PlayerProfile {`.
- [ ] **Step 2:** `npx tsc -b --noEmit` → без ошибок.
- [ ] **Step 3:** commit `feat(settings): export randomProfile — нужен для fresh-профиля старта`.

---

### Task 2: cloudProfile — decideProfileSyncForUser + тег владельца + сидинг (+тесты)

**Files:** `src/steam/cloudProfile.ts`, `tests/unit/cloudProfile.test.ts`

- [ ] **Step 1: Тесты (падающие)** — добавить в `tests/unit/cloudProfile.test.ts`:

```ts
import { decideProfileSyncForUser } from '../../src/steam/cloudProfile'

describe('decideProfileSyncForUser (identity-aware)', () => {
  const base = { cloud: null, localTs: 0, localOwner: null, currentUser: null, hasLocalProfile: false }
  it('Steam недоступен → LWW (как раньше)', () => {
    expect(decideProfileSyncForUser({ ...base, cloud: blob(10), localTs: 5, currentUser: null }).kind).toBe('adopt')
    expect(decideProfileSyncForUser({ ...base, cloud: blob(3), localTs: 5, currentUser: null })).toEqual({ kind: 'push' })
  })
  it('тег отсутствует + есть профиль (обновление) → LWW, данные не сбрасываются', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: true, cloud: blob(3), localTs: 5 })).toEqual({ kind: 'push' })
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: true, cloud: blob(9), localTs: 5 }).kind).toBe('adopt')
  })
  it('тег отсутствует + нет профиля (чистая установка) → fresh без облака / adopt с облаком', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: false, cloud: null })).toEqual({ kind: 'fresh' })
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: false, cloud: blob(7) }).kind).toBe('adopt')
  })
  it('наш аккаунт → LWW', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', localOwner: 'A', hasLocalProfile: true, cloud: blob(3), localTs: 5 })).toEqual({ kind: 'push' })
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', localOwner: 'A', hasLocalProfile: true, cloud: blob(5), localTs: 5 })).toEqual({ kind: 'noop' })
  })
  it('другой аккаунт → игнор локали: adopt при облаке, fresh без', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'B', localOwner: 'A', hasLocalProfile: true, cloud: blob(1), localTs: 999 }).kind).toBe('adopt')
    expect(decideProfileSyncForUser({ ...base, currentUser: 'B', localOwner: 'A', hasLocalProfile: true, cloud: null, localTs: 999 })).toEqual({ kind: 'fresh' })
  })
})
```

- [ ] **Step 2: Реализация** — в `src/steam/cloudProfile.ts`:

Импорты дополнить: `randomProfile, chooseFirstRunName, isFirstRun` из `../settings`; `getSteamUser` из `./steam`; `lsRemove` не нужен.

Константы: `const LOCAL_OWNER_KEY = 'oneshot:profile:owner'`, `const USER_TIMEOUT_MS = 1500`.

Тег владельца:
```ts
function localOwner(): string | null { return lsGet(LOCAL_OWNER_KEY) }
function setLocalOwner(id: string): void { lsSet(LOCAL_OWNER_KEY, id) }
```

Решение (после `decideProfileSync`):
```ts
export type IdentitySyncDecision = SyncDecision | { kind: 'fresh' }

export interface ProfileSyncContext {
  cloud: CloudBlob | null
  localTs: number
  localOwner: string | null
  currentUser: string | null
  hasLocalProfile: boolean
}

/** Identity-aware решение: привязка профиля к Steam-аккаунту поверх LWW. */
export function decideProfileSyncForUser(ctx: ProfileSyncContext): IdentitySyncDecision {
  const { cloud, localTs, localOwner, currentUser, hasLocalProfile } = ctx
  if (currentUser == null) return decideProfileSync(cloud, localTs)          // Steam неизвестен → прежний LWW
  const knownAndDifferent = localOwner != null && localOwner !== currentUser
  if (localOwner == null && hasLocalProfile) return decideProfileSync(cloud, localTs)  // обновление: не трогаем
  if (!knownAndDifferent && localOwner === currentUser) return decideProfileSync(cloud, localTs)  // наш аккаунт
  if (localOwner == null && !hasLocalProfile) return cloud ? { kind: 'adopt', profile: cloud.profile, updatedAt: cloud.updatedAt } : { kind: 'fresh' }
  // knownAndDifferent — подтверждённая смена аккаунта
  return cloud ? { kind: 'adopt', profile: cloud.profile, updatedAt: cloud.updatedAt } : { kind: 'fresh' }
}
```

`syncProfileOnStartup` переписать:
```ts
export async function syncProfileOnStartup(store: CloudStore = steamStore, getUser = getSteamUser): Promise<void> {
  if (!IS_DESKTOP) return
  const u = await withTimeout(getUser(), USER_TIMEOUT_MS, null)
  const currentUser = u?.id ?? null
  const raw = await withTimeout(store.read(CLOUD_FILE), READ_TIMEOUT_MS, null)
  const decision = decideProfileSyncForUser({
    cloud: parseCloudBlob(raw), localTs: localUpdatedAt(), localOwner: localOwner(),
    currentUser, hasLocalProfile: !isFirstRun(),
  })
  const differentAccount = currentUser != null && localOwner() != null && localOwner() !== currentUser
  if (decision.kind === 'adopt') {
    const merged = differentAccount ? decision.profile : mergeSameDayTrial(decision.profile, loadProfile())
    saveProfile(merged)
    setLocalUpdatedAt(decision.updatedAt)
  } else if (decision.kind === 'push') {
    pushProfileToCloud(loadProfile(), store)
  } else if (decision.kind === 'fresh') {
    const p = randomProfile()
    p.name = chooseFirstRunName(true, u?.name ?? null, p.name)
    saveProfile(p)
    pushProfileToCloud(p, store)
  }
  if (currentUser != null) setLocalOwner(currentUser)
}
```

- [ ] **Step 3:** `npx tsc -b --noEmit` → без ошибок.
- [ ] **Step 4:** commit `feat(steam): профиль привязан к Steam-аккаунту — сброс при смене, имя из Steam на первом запуске`.

---

### Task 3: App — убрать сидинг имени первого запуска

**Files:** `src/App.tsx`

- [ ] **Step 1:** Удалить эффект `First launch: seed the in-game name...` (строки 558-573).
- [ ] **Step 2:** Удалить строку `const [wasFirstRun] = useState(() => isFirstRun())` (206).
- [ ] **Step 3:** Импорт (53): `import { loadProfile, saveProfile } from './settings'` (убрать `isFirstRun, chooseFirstRunName`).
- [ ] **Step 4:** Импорт (59): убрать `getSteamUser` из списка `./steam/steam`.
- [ ] **Step 5:** `npx tsc -b --noEmit && npm run lint` → без ошибок.
- [ ] **Step 6:** commit `refactor(app): сидинг имени из Steam переехал в старт (cloudProfile)`.

---

### Task 4: changelog

- [ ] **Step 1:** В `CHANGELOG.md` → `## [1.1.0]` → `### Fixed`:

```markdown
- **Player profile is tied to the Steam account.** The first time an account plays, the in-game name is seeded
  from Steam; afterwards every setting syncs from that account's Steam Cloud (so a second PC picks them up).
  Switching Steam accounts on a PC no longer shows or uploads the previous player's name, skin and artwork.
```

- [ ] **Step 2:** commit `docs: changelog — профиль привязан к Steam-аккаунту`.
