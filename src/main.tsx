import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bvh'   // патч BVH-raycast (до первого рендера) — ускоряет боёвку-raycast по блокам карты
import { installGameFeelGuards } from './gameFeel'
import { installNetDiag } from './net/netDiag'
import './index.css'
// @ts-expect-error fontsource is CSS-only package
import '@fontsource/share-tech-mono'
import './ui/theme.css'
import App from './App.tsx'

installGameFeelGuards()
if (import.meta.env.DEV) installNetDiag()   // dev-диагностика P2P-коннекта (window.__netReport)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
