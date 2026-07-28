const CODE_LEN = 4   // room code length (chars [A-Z0-9])

/** Random room code: 4 chars [A-Z0-9]. Shared generator for the matchmaking code and the "With a friend" field. */
export function randomRoomCode(): string {
  return Math.random().toString(36).slice(2, 2 + CODE_LEN).toUpperCase()
}
