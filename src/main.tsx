import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bvh'   // патч BVH-raycast (до первого рендера) — ускоряет боёвку-raycast по блокам карты
import { installGameFeelGuards } from './gameFeel'
import './index.css'
// @ts-expect-error fontsource is CSS-only package
import '@fontsource/share-tech-mono'
import './ui/theme.css'
import App from './App.tsx'

installGameFeelGuards()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
