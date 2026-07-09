# Профиль игрока, привязанный к Steam-аккаунту

Дата: 2026-07-09 · Ветка: `feature/steam-profile-identity` (от `release_1.1.0`)

## Проблема

Профиль (имя, скин, рисунок `ballArt`, цвета, все настройки) хранится в одном глобальном ключе
`localStorage` `oneshot:profile` (`src/settings.ts:45`), не привязанном к Steam-аккаунту. Rust-мост
отдаёт SteamID (`steam_user` → `{id,name}`), но фронт использует только `name`. Следствия:

1. Смена Steam-аккаунта на ПК не сбрасывает локальные данные — новый аккаунт видит профиль прошлого,
   и при синхронизации старый профиль ещё и заливается в облако нового аккаунта.
2. Имя из Steam подставляется только при пустом `localStorage` (`isFirstRun`, `App.tsx:558-573`), но
   `syncProfileOnStartup` пишет профиль до монтирования App — «первый запуск» никогда не наступает,
   и на новом ПК имя из Steam не подтягивается.

## Требуемое поведение

- **Первый раз для аккаунта** (в его Steam-облаке пусто) → создаётся свежий профиль, имя берётся из
  Steam persona name.
- **Последующие заходы** (в облаке аккаунта есть профиль) → подтягиваются все его настройки (как на
  другом компьютере).
- **Смена аккаунта на том же ПК** → данные прошлого аккаунта не показываются и не заливаются в облако
  нового; берётся облако нового аккаунта (последующий заход) либо свежий профиль с именем из Steam.
- **Существующие установки** (обновление с версии без привязки) не должны пострадать: их профиль не
  сбрасывается и не перезаписывается облаком ошибочно.

## Архитектура

Вся логика — desktop-only, в `src/steam/cloudProfile.ts`; браузерный режим не меняется. `settings.ts`
остаётся платформо-независимым.

### Тег владельца (local-only)

Новый ключ `localStorage` `oneshot:profile:owner` — SteamID того, чей профиль лежит в `oneshot:profile`.
Не синхронизируется в облако (облако Steam само per-account). Пишется после каждой реконсиляции старта.

### Чистая функция решения (тестируемая)

```ts
export type IdentitySyncDecision =
  | { kind: 'adopt'; profile: PlayerProfile; updatedAt: number }
  | { kind: 'push' }
  | { kind: 'fresh' }    // первый запуск для аккаунта → новый профиль + имя из Steam
  | { kind: 'noop' }

export interface ProfileSyncContext {
  cloud: CloudBlob | null
  localTs: number
  localOwner: string | null       // владелец локального кэша (null = тег не проставлен)
  currentUser: string | null      // текущий SteamID (null = Steam недоступен)
  hasLocalProfile: boolean        // есть ли уже профиль в localStorage
}
export function decideProfileSyncForUser(ctx: ProfileSyncContext): IdentitySyncDecision
```

Логика:
- `currentUser == null` (Steam не определён) → прежний LWW `decideProfileSync(cloud, localTs)` (без
  сброса и без сидинга).
- `localOwner == null` (тег не проставлен):
  - `hasLocalProfile` (обновление с существующим профилем) → прежний LWW (не трогаем данные);
  - иначе (чистая установка, профиля нет) → первый запуск: `cloud ? adopt : fresh`.
- `localOwner === currentUser` (наш аккаунт) → прежний LWW.
- `localOwner !== currentUser` (подтверждённая смена аккаунта) → игнорируем локальный кэш:
  `cloud ? adopt : fresh`.

`decideProfileSync` (2-арг LWW) **не меняется** — переиспользуется как ядро; его тесты остаются.

### Старт (`syncProfileOnStartup`)

Desktop-only. Получает текущего Steam-пользователя (с таймаутом), читает облако, вызывает
`decideProfileSyncForUser` и применяет:
- `adopt` → `saveProfile(...)` (+ `mergeSameDayTrial` только если это НЕ подтверждённо другой аккаунт),
  `setLocalUpdatedAt(updatedAt)`;
- `push` → `pushProfileToCloud(loadProfile())`;
- `fresh` → `randomProfile()`, имя = `chooseFirstRunName(true, personaName, fresh.name)`,
  `saveProfile`, `pushProfileToCloud` (создаёт облако аккаунта);
- `noop` → ничего.

В конце, если `currentUser != null`, ставит `setLocalOwner(currentUser)`.

### Упрощение App

Эффект сидинга имени на первом запуске (`src/App.tsx:558-573`), состояние `wasFirstRun` и
теперь-неиспользуемые импорты (`isFirstRun`, `chooseFirstRunName`, `getSteamUser`) удаляются — имя из
Steam теперь сеется в старте (desktop), где известны SteamID и наличие облака.

### settings.ts

`randomProfile` делается экспортируемым (нужен старту для `fresh`). Больше ничего не меняется.

## Тесты

- Юнит `tests/unit/cloudProfile.test.ts`: `decideProfileSyncForUser` по всем веткам — Steam
  недоступен (LWW), тег отсутствует + есть профиль (LWW/миграция), тег отсутствует + нет профиля
  (fresh/adopt), наш аккаунт (LWW), другой аккаунт (adopt при облаке / fresh без облака). Существующие
  тесты `decideProfileSync`/`parseCloudBlob`/`pushProfileToCloud`/`mergeSameDayTrial` не трогаются.
- Ручная проверка (пользователь, `npm run tauri:dev`): первый запуск нового аккаунта — имя из Steam;
  смена аккаунта — чужие данные не показываются; тот же аккаунт на другом ПК — настройки из облака.

## Вне объёма

- Хранение профилей нескольких аккаунтов в одном `localStorage` (namespacing) — не нужно, источник
  правды для «последующих заходов» — Steam-облако per-account.
- Обновление имени из Steam при каждом запуске (переименование в Steam не тянется автоматически — имя
  остаётся тем, что игрок задал/получил; правится в настройках).

## Процесс

- Ветка `feature/steam-profile-identity`; тесты запускает пользователь; агент — `tsc` и `lint`.
