import { loadProfile } from './settings'

/**
 * Tiny external store for the "outline post-FX" toggle, read by Arena via useSyncExternalStore.
 *
 * Why a store and not a prop: threading postProcessing as a prop through GameCanvas/Game re-renders the
 * whole Canvas subtree on toggle — which re-applies the player RigidBody's `position={spawn}` (teleporting
 * the player back to spawn) and resets the camera. The store lets ONLY Arena re-render (to mount/unmount
 * <MapEdges/>) without touching the Canvas, Game or the bodies.
 */
let value = loadProfile().postProcessing
const listeners = new Set<() => void>()

export function getPostFx(): boolean { return value }

export function setPostFx(v: boolean): void {
  if (v === value) return
  value = v
  for (const l of listeners) l()
}

export function subscribePostFx(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
