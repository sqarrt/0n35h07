import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorRoot } from './editor/EditorRoot'
import './theme.css'

/** The map editor as its own page: no game shell around it, the hash alone routes picker vs map (EditorRoot). */
createRoot(document.getElementById('root')!).render(<StrictMode><EditorRoot /></StrictMode>)
