/**
 * Генератор имён в стиле заводских обозначений моделей (RA9, T-2000, RTX4080).
 * Имена намеренно НЕ локализуются — это «индексы железа», одинаковые на всех языках.
 * Применяется для дефолтного имени игрока (первый запуск) и для имени бота при
 * каждом добавлении его в лобби.
 */

// Буквенные префиксы «техно»-звучания (1–3 заглавных).
const PREFIXES = [
  'RA', 'RT', 'RTX', 'GTX', 'MX', 'ZX', 'XJ', 'HK', 'AX', 'RX', 'VX', 'NX',
  'TK', 'DRX', 'KR', 'SR', 'TX', 'GX', 'JX', 'BX', 'CX', 'DX', 'PX', 'ZR',
  'QL', 'OR', 'KV', 'LR', 'MK', 'ARC', 'EX', 'OX', 'T', 'K', 'X', 'V', 'Z',
] as const

// Необязательный буквенный суффикс ревизии (пустые элементы → чаще суффикса нет).
const SUFFIXES = ['', '', '', '', '', 'X', 'S', 'A', 'R', 'Z'] as const

const MIN_DIGITS = 1
const MAX_DIGITS = 4
const DASH_CHANCE = 0.3       // доля имён с дефисом (T-2000), остальное — слитно (RTX4080)
const DECIMAL_BASE = 10

/** Формат сгенерированного имени: префикс, опц. дефис, 1–4 цифры, опц. буква-ревизия. */
export const MODEL_NAME_RE = /^[A-Z]{1,3}-?\d{1,4}[A-Z]?$/

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/** Число из `count` цифр без ведущего нуля. */
function numericTail(count: number): string {
  let s = String(1 + Math.floor(Math.random() * (DECIMAL_BASE - 1)))   // первая цифра 1..9
  for (let i = 1; i < count; i++) s += Math.floor(Math.random() * DECIMAL_BASE)
  return s
}

/** Случайное имя в стиле модели робота/железа: RA9, T-2000, RTX4080, AX12S. */
export function generateModelName(): string {
  const prefix = pick(PREFIXES)
  const tail = numericTail(randInt(MIN_DIGITS, MAX_DIGITS))
  const dashed = Math.random() < DASH_CHANCE
  // Суффикс — только у слитной формы, чтобы имя оставалось коротким и читаемым.
  const suffix = dashed ? '' : pick(SUFFIXES)
  return `${prefix}${dashed ? '-' : ''}${tail}${suffix}`
}
