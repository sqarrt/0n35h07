/**
 * Гарантирует наличие платформенного нативного бинарника rolldown перед прогоном тестов.
 *
 * Зачем: node_modules лежит на /mnt/c (Windows-раздел) и ОБЩАЯ для Windows и WSL.
 * npm ставит нативный бинарник rolldown только под ту ОС, из-под которой запускался
 * `npm install`. Поэтому после установки из-под Windows под WSL отсутствует
 * `@rolldown/binding-linux-x64-gnu` (и наоборот), а vitest/vite падают на старте с
 * "Cannot find native binding".
 *
 * Что делает: пробует загрузить rolldown В ОТДЕЛЬНОМ процессе (важно: повторный
 * import в текущем процессе берётся из ESM-кэша как «уже упавший» и не видит
 * свежеустановленный бинарник). Если проба падает — вытаскивает имя недостающего
 * пакета прямо из ошибки rolldown и доустанавливает ИМЕННО его через
 * `npm install --no-save` (без правок package.json/package-lock, не трогая бинарник
 * другой ОС), затем пробует снова. Если бинарник на месте (типичный случай на
 * Windows) — быстрый no-op.
 *
 * Запускается автоматически как pre-хук тестовых скриптов (см. package.json).
 */
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

const MAX_ATTEMPTS = 3                        // на случай, если не хватает нескольких бинарников
const BINDING_RE = /@rolldown\/binding-[\w-]+/   // имя недостающего нативного пакета rolldown
// Загружаем rolldown в дочернем процессе: console.error(e) печатает и цепочку [cause],
// где rolldown называет недостающий модуль @rolldown/binding-*.
const PROBE = "import('rolldown').then(() => process.exit(0)).catch(e => { console.error(e); process.exit(7) })"

/** Версия установленного rolldown — доустанавливаем бинарник строго той же версии. */
function rolldownVersion() {
  const pkg = JSON.parse(readFileSync(require.resolve('rolldown/package.json'), 'utf8'))
  return pkg.version
}

/** Свежая проба загрузки rolldown в отдельном процессе. status===0 → бинарник на месте. */
function probe() {
  return spawnSync(process.execPath, ['-e', PROBE], { encoding: 'utf8' })
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const res = probe()
  if (res.status === 0) process.exit(0)       // бинарник загрузился — всё на месте

  const missing = res.stderr.match(BINDING_RE)?.[0]
  if (!missing) {                              // не наш случай — не маскируем чужую ошибку
    process.stderr.write(res.stderr)
    throw new Error('[ensure-native] не удалось распознать недостающий бинарник rolldown в ошибке выше')
  }

  const pkg = `${missing}@${rolldownVersion()}`
  console.log(`[ensure-native] доустанавливаю ${pkg} (платформенный бинарник rolldown отсутствует)`)
  execFileSync('npm', ['install', '--no-save', pkg], { stdio: 'inherit' })
}

if (probe().status === 0) process.exit(0)
console.error('[ensure-native] не удалось обеспечить нативный бинарник rolldown за отведённые попытки')
process.exit(1)
