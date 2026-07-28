// Aggregates the sound level from all sources (each with its own AudioContext) into a shared 0..1 for visualization.

export const ANALYSER_FFT = 256   // analyser window size (a small one is enough for time-domain RMS)
const BYTE_MID = 128              // midpoint of the byte time-domain signal (silence)

/** RMS level 0..1 from an AnalyserNode (time-domain). Quiet sound → small value, the consumer scales it. */
export function analyserLevel(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf)
  let sumSq = 0
  for (let i = 0; i < buf.length; i++) {
    const x = (buf[i] - BYTE_MID) / BYTE_MID
    sumSq += x * x
  }
  return Math.sqrt(sumSq / buf.length)
}

/**
 * Fills out[] (N bands, 0..1) with the analyser spectrum: frequency bins are spread over bands with a
 * LOG frequency split (bass doesn't dominate the whole spectrum), and MAX-combined with what's already in out
 * (multiple sources → shared spectrum).
 */
export function fillBands(analyser: AnalyserNode, freqBuf: Uint8Array<ArrayBuffer>, out: Float32Array): void {
  analyser.getByteFrequencyData(freqBuf)
  const total = freqBuf.length        // = fftSize/2 (bins)
  const n = out.length
  const minBin = 1                    // skip DC
  for (let i = 0; i < n; i++) {
    const lo = Math.floor(minBin * Math.pow(total / minBin, i / n))
    const hi = Math.max(lo + 1, Math.floor(minBin * Math.pow(total / minBin, (i + 1) / n)))
    let m = 0
    for (let j = lo; j < hi && j < total; j++) if (freqBuf[j] > m) m = freqBuf[j]
    const v = m / 255
    if (v > out[i]) out[i] = v
  }
}

/**
 * Registry of "level readers" from engines (SFX / match music / menu music — different contexts).
 * level() yields the overall level (max across sources) — "any sound" shows up in the visualization.
 */
export class AudioAnalysis {
  private readers = new Set<() => number>()
  private bandReaders = new Set<(out: Float32Array) => void>()

  /** Register a level source; returns an unsubscribe function (for unmounting). */
  addReader(fn: () => number): () => void {
    this.readers.add(fn)
    return () => { this.readers.delete(fn) }
  }

  /** Register a spectrum source (fills out via max-combining); returns an unsubscribe. */
  addBandReader(fn: (out: Float32Array) => void): () => void {
    this.bandReaders.add(fn)
    return () => { this.bandReaders.delete(fn) }
  }

  /** Current overall level 0..1 — max across all sources (empty → 0). */
  level(): number {
    let max = 0
    for (const r of this.readers) { const v = r(); if (v > max) max = v }
    return Math.min(1, Math.max(0, max))
  }

  /** Fills out[] (N bands, 0..1) with the overall spectrum — max across all sources. */
  bands(out: Float32Array): void {
    out.fill(0)
    for (const r of this.bandReaders) r(out)
  }
}
