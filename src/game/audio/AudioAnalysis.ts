// Сбор уровня звука со всех источников (у каждого свой AudioContext) в общий 0..1 для визуализации.

export const ANALYSER_FFT = 256   // размер окна анализатора (для RMS time-domain хватает небольшого)
const BYTE_MID = 128              // середина байтового time-domain сигнала (тишина)

/** RMS-уровень 0..1 из AnalyserNode (по time-domain). Тихий звук → малое значение, потребитель масштабирует. */
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
 * Заполняет out[] (N полос, 0..1) спектром анализатора: частотные бины раскладываются по полосам с
 * ЛОГ-частотной разбивкой (бас не давит весь спектр), и МАКСИМУМ-комбинируются с тем, что уже в out
 * (несколько источников → общий спектр).
 */
export function fillBands(analyser: AnalyserNode, freqBuf: Uint8Array<ArrayBuffer>, out: Float32Array): void {
  analyser.getByteFrequencyData(freqBuf)
  const total = freqBuf.length        // = fftSize/2 (бины)
  const n = out.length
  const minBin = 1                    // пропускаем DC
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
 * Реестр «читателей уровня» от движков (SFX/музыка матча/музыка меню — разные контексты).
 * level() даёт общий уровень (максимум по источникам) — «любой звук» виден в визуализации.
 */
export class AudioAnalysis {
  private readers = new Set<() => number>()
  private bandReaders = new Set<(out: Float32Array) => void>()

  /** Зарегистрировать источник уровня; возвращает функцию отписки (для размонтирования). */
  addReader(fn: () => number): () => void {
    this.readers.add(fn)
    return () => { this.readers.delete(fn) }
  }

  /** Зарегистрировать источник спектра (заполняет out максимум-комбинированием); возвращает отписку. */
  addBandReader(fn: (out: Float32Array) => void): () => void {
    this.bandReaders.add(fn)
    return () => { this.bandReaders.delete(fn) }
  }

  /** Текущий общий уровень 0..1 — максимум по всем источникам (пусто → 0). */
  level(): number {
    let max = 0
    for (const r of this.readers) { const v = r(); if (v > max) max = v }
    return Math.min(1, Math.max(0, max))
  }

  /** Заполняет out[] (N полос, 0..1) общим спектром — максимум по всем источникам. */
  bands(out: Float32Array): void {
    out.fill(0)
    for (const r of this.bandReaders) r(out)
  }
}
