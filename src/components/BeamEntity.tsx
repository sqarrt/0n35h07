import * as THREE from 'three'
import { Beam3D } from './Beam3D'
import type { Afterglow, Particle } from '../types'

export interface BeamEntityProps {
  activeRef:      React.RefObject<boolean>
  endRef:         React.RefObject<THREE.Vector3 | null>
  fireTimeRef:    React.RefObject<number>
  getStart:       () => THREE.Vector3
  afterglow?:     Afterglow | null
  particlesRef?:  React.RefObject<Particle[]>
  duration?:      number
  innerColor?:    string
  outerColor?:    string
  groupUserData?: Record<string, unknown>
}

export function BeamEntity({
  activeRef, endRef, fireTimeRef, getStart,
  afterglow, particlesRef,
  duration, innerColor = 'white', outerColor = '#0ff', groupUserData,
}: BeamEntityProps) {
  return (
    <>
      <Beam3D
        getStart={getStart}
        endRef={endRef}
        activeRef={activeRef}
        fireTimeRef={fireTimeRef}
        duration={duration}
        innerColor={innerColor}
        outerColor={outerColor}
        outerOpacity={0.6}
        groupUserData={groupUserData}
      />

      {afterglow && (() => {
        const { start, end, opacity } = afterglow
        const dir = end.clone().sub(start)
        const len = dir.length()
        const mid = start.clone().lerp(end, 0.5)
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.normalize()
        )
        return (
          <group position={mid} quaternion={quat} scale={[1, len, 1]}>
            <mesh userData={{ noRaycast: true }}>
              <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
              <meshBasicMaterial
                color={outerColor}
                transparent
                opacity={opacity * 0.4}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        )
      })()}

      {particlesRef?.current.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.life * 0.15} userData={{ noRaycast: true }}>
          <sphereGeometry args={[1, 4, 4]} />
          <meshBasicMaterial color="#ff0" />
        </mesh>
      ))}
    </>
  )
}
