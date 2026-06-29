export const LOG_FILE_RE = /^oneshot-\d{8}-\d{6}\.log$/

/** Given a directory's filenames, return the log files to delete so only the `keep` newest remain. Pure. */
export function filesToPrune(names: string[], keep: number): string[] {
  const logs = names.filter(n => LOG_FILE_RE.test(n)).sort()   // lexical sort == chronological (timestamped names)
  if (logs.length <= keep) return []
  return logs.slice(0, logs.length - keep)
}
