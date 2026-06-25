import { validateBanks, type RadioBanks } from '../music/radio/banks'

export type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

const FILES = ['moods', 'progressions', 'drums', 'instruments', 'scales'] as const

/** Fetch the five JSON banks from `base`, validate, and return typed banks. */
export async function loadRadioBanks(
  fetchFn: FetchLike = (url) => fetch(url),
  base = '/data/radio/',
): Promise<RadioBanks> {
  const raw: Record<string, unknown> = {}
  await Promise.all(
    FILES.map(async (name) => {
      const res = await fetchFn(`${base}${name}.json`)
      if (!res.ok) throw new Error(`Failed to load radio bank ${name}.json`)
      raw[name] = await res.json()
    }),
  )
  return validateBanks({
    moods: raw.moods, progressions: raw.progressions, drums: raw.drums,
    instruments: raw.instruments, scales: raw.scales,
  })
}
