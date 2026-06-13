---
name: pwa-install
description: PWA-установка игры через браузер (без офлайн-кэша)
metadata:
  type: project
---

# PWA: установка 0N35H07 через браузер

## Цель

Добавить поддержку Progressive Web App — кнопку установки в Chrome/Edge, после которой игра открывается
в отдельном окне без адресной строки. Офлайн-режим не нужен (p2p матчмейкинг требует сеть).

## Что добавляем

### 1. Иконки

Из `build/icon.png` (1024×1024) нарезаем два PNG через `@vite-pwa/assets-generator`:

- `public/pwa-192.png` — 192×192
- `public/pwa-512.png` — 512×512

### 2. `vite-plugin-pwa`

Устанавливаем как devDependency. Конфиг в `vite.config.ts`:

```ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: '0N35H07',
    short_name: '0N35H07',
    description: 'Аркадный шутер от первого лица, строго 1v1 (p2p)',
    theme_color: '#000000',
    background_color: '#000000',
    display: 'standalone',
    start_url: '.',
    icons: [
      { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  workbox: {
    globPatterns: [],   // нет прекэша
    runtimeCaching: [], // нет рантайм-кэша
  },
})
```

Service worker регистрируется автоматически — браузер доволен, кнопка установки появляется.

### 3. Генерация иконок

Одна команда (запускается вручную, иконки коммитятся в репо):

```bash
npx @vite-pwa/assets-generator --preset minimal --source build/icon.png
```

Генерирует `pwa-192.png` и `pwa-512.png` прямо в `public/`.

## Что не меняется

- `npm run build` — веб-сборка без изменений
- `npm run tauri:build` — десктоп-сборка без изменений
- Геймплей, сеть, физика — не затронуты
- SW перехватывает только навигацию, не игровые запросы

## Критерии приёмки

- Chrome показывает кнопку установки (иконка в адресной строке)
- После установки игра открывается в отдельном окне без адресной строки
- `npm run build` проходит без ошибок
- Все тесты зелёные
