import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { BeamEntity } from './BeamEntity'
import { ShieldEntity } from './ShieldEntity'
import type { BeamEntityProps } from './BeamEntity'
import { BOT_COLOR_BASE, BOT_COLOR_WHITE, BOT_WINDUP } from '../constants'

interface Hitbox {
  targetRef: React.RefObject<THREE.Mesh | null>
  name?:     string
  userData?: Record<string, any>
}

interface PlayerEntityProps {
  bodyPosRef:        React.RefObject<THREE.Vector3>
  getWindupProgress: () => number
  shieldIsActive:    () => boolean
  beam:              BeamEntityProps
  hitbox?:           Hitbox
  deathFlashRef?:    React.RefObject<(() => void) | null>
  visible?:          boolean
  color?:            string
}

export function PlayerEntity({
  bodyPosRef,
  getWindupProgress,
  shieldIsActive,
  beam,
  hitbox,
  deathFlashRef,
  visible = true,
  color = BOT_COLOR_BASE,
}: PlayerEntityProps) {
  const groupRef    = useRef<THREE.Group>(null!)
  const bodyMeshRef = useRef<THREE.Mesh>(null!)
  const bodyMatRef  = useRef<THREE.MeshStandardMaterial>(null!)
  const isFlashing  = useRef(false)

  const baseColor  = useRef(new THREE.Color(color)).current
  const whiteColor = useRef(new THREE.Color(BOT_COLOR_WHITE)).current

  useEffect(() => {
    if (!deathFlashRef) return
    deathFlashRef.current = () => {
      if (!bodyMatRef.current) return
      isFlashing.current = true
      bodyMatRef.current.color.set('red')
      setTimeout(() => {
        if (!bodyMatRef.current) return
        isFlashing.current = false
        bodyMatRef.current.color.set(color)
      }, 150)
    }
    return () => { deathFlashRef.current = null }
  }, [deathFlashRef, color])

  useFrame(() => {
    if (!groupRef.current || !bodyMeshRef.current || !bodyMatRef.current) return

    groupRef.current.position.copy(bodyPosRef.current)

    if (!isFlashing.current) {
      const wp = getWindupProgress()
      const timeSinceFire = Date.now() - beam.fireTimeRef.current
      const shrinkP = Math.min(timeSinceFire / (BOT_WINDUP / 3), 1)

      if (wp > 0) {
        bodyMeshRef.current.scale.setScalar(1 + wp * 0.4)
        bodyMatRef.current.color.lerpColors(baseColor, whiteColor, wp)
      } else if (shrinkP < 1) {
        bodyMeshRef.current.scale.setScalar(1 + 0.4 * (1 - shrinkP))
        bodyMatRef.current.color.copy(baseColor)
      } else {
        bodyMeshRef.current.scale.setScalar(1)
        bodyMatRef.current.color.copy(baseColor)
      }
    }
  })

  const initPos = bodyPosRef.current.toArray() as [number, number, number]

  return (
    <>
      {/* visible=false hides body + shield together; beam always renders */}
      <group ref={groupRef} position={initPos} visible={visible}>
        {hitbox && (
          <mesh
            ref={hitbox.targetRef}
            name={hitbox.name ?? 'target'}
            userData={hitbox.userData}
            visible={false}
          >
            <boxGeometry args={[1, 2, 1]} />
            <meshStandardMaterial />
          </mesh>
        )}

        <mesh ref={bodyMeshRef} position={[0, 0.5, 0]} castShadow userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial ref={bodyMatRef} color={color} />
        </mesh>

        <group position={[0, 0.5, 0]}>
          <ShieldEntity isActive={shieldIsActive} />
        </group>
      </group>

      <BeamEntity {...beam} />
    </>
  )
}
