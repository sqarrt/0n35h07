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
 * Реестр «читателей уровня» от движков (SFX/музыка матча/музыка меню — разные контексты).
 * level() даёт общий уровень (максимум по источникам) — «любой звук» виден в визуализации.
 */
export class AudioAnalysis {
  private readers = new Set<() => number>()

  /** Зарегистрировать источник уровня; возвращает функцию отписки (для размонтирования). */
  addReader(fn: () => number): () => void {
    this.readers.add(fn)
    return () => { this.readers.delete(fn) }
  }

  /** Текущий общий уровень 0..1 — максимум по всем источникам (пусто → 0). */
  level(): number {
    let max = 0
    for (const r of this.readers) { const v = r(); if (v > max) max = v }
    return Math.min(1, Math.max(0, max))
  }
}
