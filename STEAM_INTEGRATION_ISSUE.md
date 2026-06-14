# Интеграция со Steam без потери браузерной версии

## Контекст и цель

Игра планируется к публикации в Steam. Steam-аккаунт становится идентичностью игрока и закрывает самое трудное — Sybil-устойчивость (аккаунты дорогие, их не наплодить). Valve бесплатно предоставляет: Auth (личность), Inventory Service (косметика), Leaderboards/Stats (ELO), Matchmaking, Cloud.

**Браузерная версия должна остаться живой**, но в урезанном виде («lite»):
- ✅ p2p-матчмейкинг (как сейчас — Trystero/Nostr);
- ❌ нет инвентаря/косметики;
- ❌ нет ELO/рейтинга.

Полный набор (косметика, ELO, лидерборды) — только в Steam-сборке (Tauri). Рейтинг/инвентарь/лидерборды хранятся на стороне Valve; своего бэкенда не поднимаем.

## Ключевой архитектурный принцип

**Один кодовый базис, фичи за capability-гейтом — без форка.** Платформа прячется за интерфейсом ровно по образцу существующего `INet`/`createNet` и `IDiscovery`. Симуляция (`src/game/`), R3F-хост и HUD остаются платформенно-независимыми и **не трогаются**.

```ts
// набросок, не финальный API
interface PlatformCapabilities {
  identity: boolean;     // SteamID/ник
  inventory: boolean;    // косметика
  leaderboards: boolean; // ELO/лидерборды
  ranked: boolean;       // матч влияет на ELO
}

interface IPlatform {
  readonly capabilities: PlatformCapabilities;
  getIdentity(): Promise<PlayerIdentity | null>;
  getInventory?(): Promise<CosmeticItem[]>;
  reportMatchResult?(result: MatchResult): Promise<void>;
  // ...
}

function createPlatform(): IPlatform; // SteamPlatform | WebPlatform по окружению
```

UI и игровая логика спрашивают `platform.capabilities.*`, а не «мы в Steam?». Отсутствие фичи в web — это просто `false`, а не ветвление по сборке.

## Матрица возможностей

| Возможность | Steam-сборка (Tauri) | Web (lite) |
|---|---|---|
| Идентичность | SteamID + ник/аватар | анонимная (как сейчас) |
| Матчмейкинг | общий p2p (Trystero/Nostr) | общий p2p (Trystero/Nostr) |
| Косметика/инвентарь | Steam Inventory Service | — |
| ELO / лидерборды | Steam Leaderboards/Stats | — |
| Ranked (влияет на ELO) | да (если оба игрока Steam-верифицированы) | нет (всегда casual) |

## Объём работ

1. **`IPlatform` + `createPlatform()` + `PlatformCapabilities`** — абстракция в renderer по образцу `INet`/`createNet`. Capability-флаги — единственный источник правды для гейтинга UI и логики.
2. **`WebPlatform` (lite / null-object)** — identity=anon, inventory/leaderboards/ranked = выключены; web-сборка работает в точности как сейчас, существующий p2p-матчмейкинг не трогаем.
3. **`SteamPlatform` (Tauri)** — инициализация Steamworks в Rust-бэкенде; мост во фронт через Tauri commands/events; фронт-прокси реализует `IPlatform`, дёргая backend. **Spike:** выбрать нативный биндинг (steamworks-sys / steamworks crate).
4. **Identity / Auth** — чтение SteamID, ника, аватара; `GetAuthSessionTicket`/`BeginAuthSession` для P2P-верификации соперника без своего сервера.
5. **Inventory / косметика** — `ISteamInventory` (`GetAllItems`); отображение и применение шмоток (только Steam-сборка).
6. **Leaderboards / ELO** — `ISteamUserStats` (`FindOrCreateLeaderboard`, `UploadLeaderboardScore`); репорт результата после матча. Учесть rate-limit 10/10 мин и «одна загрузка в полёте».
7. **Матчмейкинг — решение по варианту** (см. открытые вопросы). Базовый план: **оставить общий p2p для обеих сборок**, Steam-сборка дополнительно репортит ELO. Форк матчмейкинга не делать без необходимости.
8. **UI capability-gating** — меню/профиль/HUD скрывают Steam-only разделы в web **без «прыжков» layout** (правило неподвижности интерфейса из CLAUDE.md): единый каркас, блоки появляются/исчезают по capability, размеры/позиции не плывут.
9. **Сборка/бандлинг** — web Vite-сборка без изменений и **без нативного steam-кода** в бандле (условный импорт по платформе; Rust-код Steamworks только в Tauri-бэкенде). Steam-сборка: `steam_appid.txt` для dev, `cargo tauri build`, Steam DRM-wrap.
10. **Тесты** — web e2e (matchmaking/lobby specs) остаются зелёными; юниты на capability-гейтинг через мок `IPlatform`; реальные Steam-вызовы проверяются вручную (в headless/CI невозможны).

## Технические заметки и ограничения

- **Steamworks нативный** → только Tauri Rust-бэкенд; фронт — через Tauri commands. Web-бандл **не должен** содержать steam-код. Развязка — через `createPlatform()` с условным импортом.
- **Биндинг (spike):** основной кандидат `steamworks.js` (prebuilt napi, активно поддерживается); запасной — `greenworks` (есть в Steamworks-экосистеме, но старее). Решить в первой итерации.
- **Целостность ELO:** Steam Leaderboards client-reported и rate-limited → значения накручиваемы. Для v1 приемлемо. **Future:** со-подпись результата обоими Steam-Auth-верифицированными игроками (host + opponent) перед загрузкой, чтобы хост не мог переврать счёт.
- **Dev-окружение:** нужен запущенный Steam-клиент + `steam_appid.txt` + реальный AppID (Steamworks partner).
- **tsconfig:** `erasableSyntaxOnly` — без enum/namespace/parameter-properties.

## Кросс-плей (важное проектное решение)

Обе сборки используют **один p2p-слой** (Trystero/Nostr), поэтому web- и Steam-игроки **могут играть друг с другом** — это держит пул живым и объединённым, а не разрезает аудиторию. Правило: **матч влияет на ELO только если оба игрока Steam-Auth-верифицированы**; если хоть один из web — матч casual. Так «урезанность» web получается естественно, без отдельной логики.

## Критерии приёмки

- Web-сборка собирается и работает как сейчас; нативного steam-кода в бандле нет; все web e2e зелёные.
- Steam-сборка (Tauri) инициализирует Steamworks, читает SteamID/ник/аватар и инвентарь, пишет и читает лидерборд.
- Один игровой код; все различия — за `IPlatform`/`capabilities`; форка симуляции/HUD/матчмейкинга нет.
- В web Steam-only разделы UI скрыты без визуальных скачков.

## Вне объёма

- Серверный античит / валидация ELO (отдельная будущая задача).
- Микротранзакции, маркетплейс предметов.
- Кросс-прогресс web↔Steam (web без персистентного состояния).

## Открытые вопросы

1. Матчмейкинг в Steam-сборке: общий p2p или `ISteamMatchmaking` lobbies? *(Реком.: общий p2p ради кросс-плея, ELO-гейт по Steam-Auth.)*
2. Разрешаем casual-матчи web↔Steam? *(Реком.: да — держит пул живым.)*
3. Биндинг: `steamworks.js` или `greenworks`? *(Spike.)*
4. Нужен ли в Steam-сборке явный отдельный режим «ranked», отличный от casual?
