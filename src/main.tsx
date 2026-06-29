import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bvh'   // BVH-raycast patch (before first render) — speeds up combat raycast against map blocks
import { installGameFeelGuards } from './gameFeel'
import { installNetDiag } from './net/netDiag'
import { installGameLog } from './diag/gameLog'
import { IS_DESKTOP } from './platform'
import { getSteamUser } from './steam/steam'
import { syncProfileOnStartup, installProfileCloudSync } from './steam/cloudProfile'
import './index.css'
// @ts-expect-error fontsource is CSS-only package
import '@fontsource/share-tech-mono'
import './ui/theme.css'
import App from './App.tsx'

installGameFeelGuards()
void installGameLog()   // desktop: open the per-session diagnostic log file (no-op in the browser/e2e)
// RTC-capture patch: dev (for __netReport) AND desktop (feeds the ICE verdict into the session log for field diagnosis).
if (import.meta.env.DEV || IS_DESKTOP) installNetDiag()
// Dev proof-of-life for the Steam bridge: logs the persona name on desktop, null in the browser.
if (import.meta.env.DEV) void getSteamUser().then(u => console.log('[steam] user:', u))
// Dev-only smoke-test harness for the Steam networking primitives (window.__steamNet).
if (import.meta.env.DEV) void import('./steam/steamNetDebug').then(m => m.installSteamNetDebug())

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Reconcile the profile with Steam Cloud BEFORE mounting (so App's loadProfile() sees the
// adopted version), then install the save→cloud push. Off-Steam this resolves instantly, so
// the browser boot is unchanged. A timeout inside syncProfileOnStartup keeps boot from hanging.
void syncProfileOnStartup().then(() => {
  installProfileCloudSync()
  mount()
})
