import { PLAYER_COLORS, BALL_MODELS } from './constants'
import type { BallModel } from './constants'

export type DefaultView = 'fp' | 'tp'

export interface PlayerProfile {
  name: string
  primaryColor: string
  reserveColor: string
  defaultView: DefaultView   // стартовый вид (локальное предпочтение, не сетевое)
  ballModel: BallModel       // модель сферы (сетевая косметика)
  postProcessing: boolean    // графика: экранный контур рёбер (постобработка); локальное предпочтение
}

const KEY = 'oneshot:profile'
export const NAME_MAX = 16

/** Шуточные имена в стиле игры — назначаются случайно при первом запуске. */
export const DEFAULT_NAMES = [
  'Ваншот Мазила', 'Дэш в Стену', 'Кэмпер Поневоле', 'Случайный Хедшот',
  'Жертва Баланса', 'АФК Профессионал', 'Гроза Ботов', 'Понерфили Меня',
  'Имба на Минуту', 'Респаун Энджоер', 'Промах Года', 'Один Выстрел',
  'Тащер (нет)', 'Без Пинга Никак', 'Луч Надежды', 'Шар Судьбы',
]

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

/** Профиль первого запуска: случайное шуточное имя + случайная пара цветов. */
function randomProfile(): PlayerProfile {
  const primaryColor = pick(PLAYER_COLORS)
  const reserveColor = pick(PLAYER_COLORS.filter(c => c !== primaryColor))
  return { name: pick(DEFAULT_NAMES), primaryColor, reserveColor, defaultView: 'fp', ballModel: 'smooth', postProcessing: true }
}

/** Привести к валидному виду: имя обрезаем, цвета — только из палитры, резерв ≠ основной. */
function sanitize(p: Partial<PlayerProfile>): PlayerProfile {
  const name = (typeof p.name === 'string' ? p.name : '').trim().slice(0, NAME_MAX) || 'Игрок'
  const primaryColor = PLAYER_COLORS.includes(p.primaryColor as string) ? (p.primaryColor as string) : PLAYER_COLORS[0]
  let reserveColor = PLAYER_COLORS.includes(p.reserveColor as string) ? (p.reserveColor as string) : PLAYER_COLORS[1]
  if (reserveColor === primaryColor) reserveColor = PLAYER_COLORS.find(c => c !== primaryColor)!
  const defaultView: DefaultView = p.defaultView === 'tp' ? 'tp' : 'fp'   // нет поля/мусор → fp
  const ballModel: BallModel = BALL_MODELS.includes(p.ballModel as BallModel) ? (p.ballModel as BallModel) : 'smooth'
  const postProcessing = typeof p.postProcessing === 'boolean' ? p.postProcessing : true   // по умолчанию вкл
  return { name, primaryColor, reserveColor, defaultView, ballModel, postProcessing }
}

/** Загрузить профиль. Первый запуск (нет в localStorage) → создать случайный и сразу сохранить. */
export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return sanitize(JSON.parse(raw))
  } catch { /* недоступно/битый JSON — создаём заново */ }
  const fresh = randomProfile()
  saveProfile(fresh)
  return fresh
}

export function saveProfile(p: Partial<PlayerProfile>): void {
  try { localStorage.setItem(KEY, JSON.stringify(sanitize(p))) } catch { /* ignore */ }
}
