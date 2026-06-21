/* eslint-disable react-refresh/only-export-components -- provider + hook in one module; fast-refresh is non-critical here */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ISfxEngine } from '../game/audio/sfx/types'

const SfxCtx = createContext<ISfxEngine | null>(null)

export function SfxProvider({ engine, children }: { engine: ISfxEngine; children: ReactNode }) {
  return <SfxCtx.Provider value={engine}>{children}</SfxCtx.Provider>
}

/** UI hook: safe outside the provider (no-op). */
export function useSfx(): Pick<ISfxEngine, 'play2D'> {
  const engine = useContext(SfxCtx)
  return { play2D: (e, g) => engine?.play2D(e, g) }
}
