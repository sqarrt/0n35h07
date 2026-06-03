// NOTE: This component is scheduled for deletion in Task 10.
// KillEvent was removed from useGameHUD in Task 5; kept as stub to avoid breaking tsc.
interface KillEvent { id: number; killer: string; victim: string }

/** Лента убийств (как в CS): «убийца ⟶ жертва» в правом верхнем углу, гаснет через ~4с. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function KillFeed(_props: { lastKill: KillEvent | null }) {
  return null
}
