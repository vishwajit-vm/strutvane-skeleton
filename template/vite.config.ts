// The React UI's build (Vite). `node strut dev` mounts Vite on the app's own port (one origin for
// the API and the UI, no proxy, no CORS); `node strut build` writes the production files to
// dist/web, which `node strut start` serves next to the API.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'resources/ui',
  plugins: [react()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
})
