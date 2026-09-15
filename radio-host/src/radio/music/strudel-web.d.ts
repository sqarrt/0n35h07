// Minimal ambient types for @strudel/web (the package ships no .d.ts).
// Only the surface we actually call is declared.
declare module '@strudel/web' {
  export interface InitStrudelOptions {
    prebake?: () => unknown
    loadDefaultSamples?: boolean
  }
  export function initStrudel(options?: InitStrudelOptions): Promise<void>
  // Loads audio worklets (e.g. the supersaw oscillator) and resumes the context.
  export function initAudio(options?: unknown): Promise<void>
  export function evaluate(code: string): Promise<unknown>
  export function hush(): void
  export function samples(
    source: string | Record<string, string | string[]>,
    base?: string,
  ): Promise<unknown>
  export function getAudioContext(): AudioContext
  export function getSuperdoughAudioController(): {
    output?: { destinationGain?: GainNode; output?: GainNode }
  }
}
