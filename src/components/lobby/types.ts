/** Один игрок в слоте лобби. */
export interface LobbySlot { name: string; color: string; ready: boolean }
/** Слот соперника: бот или удалённый человек. */
export type OppSlot = LobbySlot & { isBot: boolean }
