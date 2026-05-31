import * as THREE from 'three'

export interface Afterglow {
  start:   THREE.Vector3
  end:     THREE.Vector3
  opacity: number
}

export interface Particle {
  pos:  THREE.Vector3
  vel:  THREE.Vector3
  life: number
}
