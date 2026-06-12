import type { PoolListing } from '../matchmaking'

/**
 * Pub/sub обнаружения по корзинам (без WebRTC-mesh). Хост публикует листинг в корзину
 * (с heartbeat/TTL на уровне реализации), клиент подписывается на корзину. WebRTC устанавливается
 * отдельно — одной связью между нашедшимися соперниками (приватная комната хоста по коду).
 */
export interface IDiscovery {
  publish(bucket: string, listing: PoolListing): void
  withdraw(bucket: string, code: string): void
  /** Подписка: onListing зовётся на каждый текущий (снапшот) и новый листинг корзины. Возвращает unsubscribe. */
  subscribe(bucket: string, onListing: (listing: PoolListing) => void): () => void
  dispose(): void
}
