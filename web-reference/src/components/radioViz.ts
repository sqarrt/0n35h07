// Visualizer modes (shared between RadioVisualizer + the explorer's switcher). 'auto' rotates the concrete ones.
export type VizMode = 'auto' | 'scope' | 'bars' | 'radial' | 'field'
export const VIZ_MODES: VizMode[] = ['auto', 'scope', 'bars', 'radial', 'field']
export const VIZ_ICON: Record<VizMode, string> = { auto: '⟳', scope: '◉', bars: '▥', radial: '◎', field: '✦' }
export const VIZ_CONCRETE: VizMode[] = ['scope', 'bars', 'radial', 'field']
export const VIZ_ROTATE_FRAMES = 60 * 18 // 'auto' cycles a different visualizer every ~18s
