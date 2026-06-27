import type { Weighted } from './weighted'

/** Per-category ring buffer of the last N choices, used to discourage repeats. */
export class AntiRepeatBuffer {
  private readonly window: number
  private readonly recent = new Map<string, string[]>()

  constructor(window: number) { this.window = Math.max(0, window) }

  /** Forget all history — used to replay the buffer to a deterministic state on a track jump. */
  clear(): void { this.recent.clear() }

  record(category: string, value: string): void {
    if (this.window === 0) return
    const arr = this.recent.get(category) ?? []
    arr.push(value)
    while (arr.length > this.window) arr.shift()
    this.recent.set(category, arr)
  }

  isRecent(category: string, value: string): boolean {
    return (this.recent.get(category) ?? []).includes(value)
  }

  recentList(category: string): readonly string[] {
    return this.recent.get(category) ?? []
  }

  /** Multiply the weight of any recently-used option by `penalty` (default 0.1). */
  penalize<T extends string>(
    category: string, entries: readonly Weighted<T>[], penalty = 0.1,
  ): Weighted<T>[] {
    return entries.map(([v, w]) => [v, this.isRecent(category, v) ? w * penalty : w] as Weighted<T>)
  }
}
