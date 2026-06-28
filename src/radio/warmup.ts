// Radio warmup / init state machine. Kept dependency-injected (DIP) so it is unit-testable without the
// real Strudel engine or the network: App supplies the concrete steps (load banks → make+init engine →
// build the RadioController), the test supplies stubs and asserts the idle→loading→ready/error transitions.

export type RadioInitState = 'idle' | 'loading' | 'ready' | 'error'

export interface WarmupSteps<TBanks, TEngine, TController> {
  /** Fetch + validate the JSON banks. */
  loadBanks: () => Promise<TBanks>
  /** Construct the Strudel engine (no I/O yet). */
  makeEngine: () => TEngine
  /** Initialize the engine — registers AudioWorklets, resumes the AudioContext, prefetches CDN samples. */
  initEngine: (engine: TEngine) => Promise<void>
  /** Build the RadioController once banks + engine are ready. */
  makeController: (engine: TEngine, banks: TBanks) => TController
}

/**
 * Drive the radio warmup once. Sets `loading`, then on success `ready` (returning the controller),
 * or `error` (returning null) if any step throws. Never throws — the caller reads state via `setState`.
 */
export async function warmupRadio<TBanks, TEngine, TController>(
  steps: WarmupSteps<TBanks, TEngine, TController>,
  setState: (s: RadioInitState) => void,
): Promise<TController | null> {
  setState('loading')
  try {
    const banks = await steps.loadBanks()
    const engine = steps.makeEngine()
    await steps.initEngine(engine)
    const controller = steps.makeController(engine, banks)
    setState('ready')
    return controller
  } catch {
    setState('error')
    return null
  }
}
