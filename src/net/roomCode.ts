const CODE_LEN = 4   // длина кода комнаты (символы [A-Z0-9])

/** Случайный код комнаты: 4 символа [A-Z0-9]. Общий генератор для matchmaking-кода и поля «С другом». */
export function randomRoomCode(): string {
  return Math.random().toString(36).slice(2, 2 + CODE_LEN).toUpperCase()
}
