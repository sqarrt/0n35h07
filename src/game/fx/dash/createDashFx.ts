import * as THREE from 'three'
import type { DashStyle } from '../../../constants'
import type { IDashTrail } from '../../abstractions'
import { AfterimageTrail } from '../AfterimageTrail'
import { WaveTrail } from './WaveTrail'
import { RiftTrail } from './RiftTrail'

/** Factory for the dash trail by chosen style (STREAK/WAVE/RIFT). */
export function createDashFx(style: DashStyle, playerColor: string): IDashTrail {
  switch (style) {
    case 'wave': return new WaveTrail(playerColor)
    case 'rift': return new RiftTrail(playerColor)
    case 'streak': return new AfterimageTrail(new THREE.Color(playerColor))
  }
}
