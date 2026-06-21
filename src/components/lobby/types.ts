/** A single player in a lobby slot. */
export interface LobbySlot { name: string; color: string; ready: boolean }
/** Opponent slot: a bot or a remote human. */
export type OppSlot = LobbySlot & { isBot: boolean }
/** Subtab of the "Play" screen. */
export type LobbyTab = 'matchmaking' | 'friend' | 'bot'
