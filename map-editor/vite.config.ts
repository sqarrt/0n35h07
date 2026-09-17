import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mapsBridge } from './bridge/mapsBridge'

/**
 * The map editor's dev server. It builds nothing: the editor is a tool, and what it produces are the game's own map
 * files, written straight into the Godot project through the bridge plugin. Run it with `npm run dev` and open
 * http://localhost:5173/ — the hash routes the picker (#) and a map (#editor-<id>).
 *
 * The game's maps/ folder is watched by nobody: an autosave there must not reload the page mid-edit.
 */
export default defineConfig({
  plugins: [react(), mapsBridge()],
  server: {
    watch: { ignored: ['**/maps/**', '**/assets/maps/previews/**', '**/.backups/**'] },
  },
})
