class_name NetConst
## Networking constants — ported from web-reference/src/constants.ts.

const NET_SNAPSHOT_HZ := 30       # per-peer snapshot broadcast rate
const NET_INTERP_DELAY_MS := 100  # render remotes this far in the past (absorbs jitter)
## The shooter holds a predicted opponent death this long, ignoring snapshots that still show the victim alive (sent
## before the claim arrived), until the owner's kill confirms it or the grace runs out (rejected or lost: revive).
const NET_PREDICT_KILL_MS := 250.0
