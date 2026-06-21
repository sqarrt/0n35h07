import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bvh'   // BVH-raycast patch (before first render) — speeds up combat raycast against map blocks
import { installGameFeelGuards } from './gameFeel'
import { installNetDiag } from './net/netDiag'
import './index.css'
// @ts-expect-error fontsource is CSS-only package
import '@fontsource/share-tech-mono'
import './ui/theme.css'
import App from './App.tsx'

installGameFeelGuards()
if (import.meta.env.DEV) installNetDiag()   // dev diagnostics for P2P connection (window.__netReport)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
