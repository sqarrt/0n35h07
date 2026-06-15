/**
 * Формат демо-записи. КЛЮЧЕВОЙ принцип — НЕЗАВИСИМОСТЬ КАДРОВ: каждый DemoFrame содержит ПОЛНОЕ
 * абсолютное состояние сцены (камера, рендер-состояние игроков, счёт, таймер, серии, фаза) + только
 * транзиентные FX этого кадра (выстрел/килл/блок). Поэтому любой непрерывный подотрезок frames[i..j]
 * воспроизводится корректно сам по себе — без знания о предыдущих кадрах.
 */
import type { MatchEvent, Vec3, RosterEntry } from '../../net/protocol'
import type { MatchPhase, MapId } from '../../constants'

export const DEMO_VERSION = 1

export interface DemoCam {
  p: Vec3                                   // позиция камеры
  q: [number, number, number, number]       // кватернион (x,y,z,w)
  fov: number
}

/** Абсолютное рендер-состояние игрока в кадре (всё, что нужно нарисовать его и его HUD-вклад). */
export interface DemoPlayerState {
  id: number
  pos: Vec3
  aimDir: Vec3
  alive: boolean
  shieldActive: boolean
  dashing: boolean
  windupProgress: number
  respawning: boolean
  bodyVisible: boolean       // в FP свой шар скрыт — пишем, чтобы реплей повторил
  kills: number              // абсолютный счёт (для верного HUD на любом подотрезке)
  deaths: number
  streakCount: number        // текущая серия (тир выводится на воспроизведении)
  // Кулдауны для HUD POV-игрока (готовность: 1 = готов). Нет в старых демо → дефолты на воспроизведении.
  beamCooldown?: number      // прицел (готовность луча)
  dashCooldown?: number      // индикатор дэша
  shieldProgress?: number    // скобки щита (готовность щита)
  respawnProgress?: number   // оверлей возрождения (1→0); значим, когда respawning=true
}

export interface DemoFrame {
  tMs: number                // время от начала записи (для тайминга/слайсинга)
  cam: DemoCam
  players: DemoPlayerState[]
  remainingMs: number        // остаток таймера матча (абсолютно)
  phase: MatchPhase
  events: MatchEvent[]       // транзиентные FX этого кадра (выстрелы/киллы/блоки/респавны/move)
}

export interface DemoFile {
  version: typeof DEMO_VERSION
  mapId: MapId
  durationMs: number
  localId: number            // чьими «глазами» снято (для справки; камера всё равно в DemoCam)
  reserveColor?: string      // «второй» цвет локального игрока (кольцо планеты); нет → берём из профиля
  roster: RosterEntry[]      // цвета/модели/скины игроков — для постройки тех же Body на воспроизведении
  frames: DemoFrame[]
}
