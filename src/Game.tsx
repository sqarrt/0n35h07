import { useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls, Line } from '@react-three/drei'
import { Arena } from './Arena'
import { useGameInput } from './useGameInput'

interface Beam {
  start: THREE.Vector3
  end: THREE.Vector3
}

interface GameProps {
  setBeamProgress: (v: number) => void
  setShieldProgress: (v: number) => void
  setShieldVisible: (v: boolean) => void
}

const BEAM_COOLDOWN = 1500
const BEAM_DURATION = 250
const SHIELD_DURATION = 500
const SHIELD_COOLDOWN = 2000
const MOVE_SPEED = 7
const EYE_HEIGHT = 1.7
const JUMP_FORCE = 8
const GRAVITY = -22

export function Game({ setBeamProgress, setShieldProgress, setShieldVisible }: GameProps) {
  const { camera, scene } = useThree()
  const keys = useGameInput()

  const targetRef = useRef<THREE.Mesh>(null)
  const shieldMeshRef = useRef<THREE.Mesh>(null)

  const beamCooldown = useRef(false)
  const beamCooldownEnd = useRef(0)
  const shieldActive = useRef(false)
  const shieldCooldown = useRef(false)
  const shieldCooldownEnd = useRef(0)
  const lastHudUpdate = useRef(0)
  const velocityY = useRef(0)
  const onGround = useRef(true)

  const [beam, setBeam] = useState<Beam | null>(null)
  const [targetAlive, setTargetAlive] = useState(true)

  // Attach shield sphere to camera
  useEffect(() => {
    const geo = new THREE.SphereGeometry(0.9, 16, 16)
    const mat = new THREE.MeshStandardMaterial({
      color: 'royalblue',
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    })
    const shield = new THREE.Mesh(geo, mat)
    shield.userData.noRaycast = true
    shield.visible = false
    shieldMeshRef.current = shield
    camera.add(shield)
    return () => {
      camera.remove(shield)
      geo.dispose()
      mat.dispose()
    }
  }, [camera])

  // Shoot (ЛКМ), shield (ПКМ), jump (Space)
  useEffect(() => {
    const fireBeam = () => {
      if (beamCooldown.current) return
      if (!document.pointerLockElement) return

      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)

      const targets: THREE.Object3D[] = []
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && !obj.userData.noRaycast) {
          targets.push(obj)
        }
      })

      const raycaster = new THREE.Raycaster(camera.position.clone(), dir)
      const hits = raycaster.intersectObjects(targets)

      const start = camera.position.clone()
      let end: THREE.Vector3

      if (hits.length > 0) {
        end = hits[0].point.clone()
        if (hits[0].object.name === 'target') {
          setTargetAlive(false)
          setTimeout(() => setTargetAlive(true), 10000)
        }
      } else {
        end = start.clone().addScaledVector(dir, 100)
      }

      setBeam({ start, end })
      beamCooldown.current = true
      beamCooldownEnd.current = Date.now() + BEAM_COOLDOWN
      setTimeout(() => setBeam(null), BEAM_DURATION)
      setTimeout(() => { beamCooldown.current = false }, BEAM_COOLDOWN)
    }

    const activateShield = () => {
      if (shieldCooldown.current || shieldActive.current) return
      if (!document.pointerLockElement) return

      shieldActive.current = true
      setShieldVisible(true)
      if (shieldMeshRef.current) shieldMeshRef.current.visible = true
      shieldCooldownEnd.current = Date.now() + SHIELD_DURATION + SHIELD_COOLDOWN

      setTimeout(() => {
        shieldActive.current = false
        setShieldVisible(false)
        if (shieldMeshRef.current) shieldMeshRef.current.visible = false
        shieldCooldown.current = true
      }, SHIELD_DURATION)

      setTimeout(() => {
        shieldCooldown.current = false
      }, SHIELD_DURATION + SHIELD_COOLDOWN)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) fireBeam()
      if (e.button === 2) activateShield()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (onGround.current) {
          velocityY.current = JUMP_FORCE
          onGround.current = false
        }
      }
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [camera, scene, setShieldVisible])

  // Expose camera to window for playwright tests
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__debugCamera = camera
    return () => { delete (window as unknown as Record<string, unknown>).__debugCamera }
  }, [camera])

  // По умолчанию Three.js разворачивает камеру к origin — фиксируем горизонт
  useEffect(() => {
    camera.rotation.set(0, 0, 0)
  }, [camera])

  // Movement + jump physics + HUD updates
  useFrame((state, delta) => {
    const k = keys.current
    const cam = state.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()

    if (k.forward) cam.position.addScaledVector(dir, MOVE_SPEED * delta)
    if (k.back) cam.position.addScaledVector(dir, -MOVE_SPEED * delta)
    if (k.left) cam.position.addScaledVector(right, -MOVE_SPEED * delta)
    if (k.right) cam.position.addScaledVector(right, MOVE_SPEED * delta)

    // Jump physics
    if (!onGround.current) {
      velocityY.current += GRAVITY * delta
      cam.position.y += velocityY.current * delta
    }

    if (cam.position.y <= EYE_HEIGHT) {
      cam.position.y = EYE_HEIGHT
      velocityY.current = 0
      onGround.current = true
    }

    // Throttled HUD update
    const now = Date.now()
    if (now - lastHudUpdate.current > 50) {
      lastHudUpdate.current = now

      const beamP = beamCooldown.current
        ? Math.max(0, 1 - (beamCooldownEnd.current - now) / BEAM_COOLDOWN)
        : 1
      setBeamProgress(beamP)

      const totalShieldTime = SHIELD_DURATION + SHIELD_COOLDOWN
      const shieldP = shieldActive.current || shieldCooldown.current
        ? Math.max(0, 1 - (shieldCooldownEnd.current - now) / totalShieldTime)
        : 1
      setShieldProgress(shieldP)
    }
  })

  return (
    <>
      <PointerLockControls />
      <Arena targetRef={targetRef} targetAlive={targetAlive} />

      {beam && (
        <Line
          points={[beam.start, beam.end]}
          color="cyan"
          lineWidth={3}
        />
      )}
    </>
  )
}
