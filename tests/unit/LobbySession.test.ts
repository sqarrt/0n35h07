import { describe, it, expect } from 'vitest'
import { createLoopbackPair } from '../../src/net/LoopbackNet'
import { LobbySession } from '../../src/net/LobbySession'
import type { LobbyView } from '../../src/net/LobbySession'
import type { PlayerProfile } from '../../src/settings'

const HOST: PlayerProfile = { name: 'Хост', primaryColor: '#4af', reserveColor: '#fa4' }

/** Поднимает хост+клиент на loopback (доставка синхронная → хендшейк завершается сразу). */
function handshake(clientProfile: PlayerProfile) {
  const [hostNet, clientNet] = createLoopbackPair('H', 'C')
  const host = new LobbySession(hostNet, 'host', 'AB12', HOST)
  let hostView: LobbyView | undefined
  host.onChange(v => { hostView = v })
  const client = new LobbySession(clientNet, 'client', 'AB12', clientProfile)
  let clientView: LobbyView | undefined
  client.onChange(v => { clientView = v })
  return { host, client, hostView: hostView!, clientView: clientView! }
}

describe('LobbySession — назначение цветов хостом', () => {
  it('клиент с тем же основным цветом, что у хоста, получает свой резервный', () => {
    const { hostView } = handshake({ name: 'Гость', primaryColor: '#4af', reserveColor: '#4fa' })
    const clientEntry = hostView.roster.find(r => r.id === 1)!
    expect(clientEntry.color).toBe('#4fa')   // основной #4af занят хостом → резервный
    expect(clientEntry.name).toBe('Гость')
  })

  it('клиент со свободным основным цветом получает именно его', () => {
    const { hostView } = handshake({ name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa' })
    expect(hostView.roster.find(r => r.id === 1)!.color).toBe('#fd4')
  })

  it('клиент получает свой id и общий ростер (ASSIGN дошёл)', () => {
    const { clientView } = handshake({ name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa' })
    expect(clientView.connected).toBe(true)
    expect(clientView.localPlayerId).toBe(1)
    expect(clientView.roster.map(r => r.id).sort()).toEqual([0, 1])
  })
})
