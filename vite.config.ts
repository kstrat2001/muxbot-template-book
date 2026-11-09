import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// darkmux runs the preview on ports it picks (see .darkmux/preview.json):
// PORT for the site and VITE_HMR_PORT for live reload, so two previews
// never collide. Without them, `npm run dev` uses Vite's defaults.
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT) || 5173
const hmrPort = Number(process.env.VITE_HMR_PORT) || undefined

export default defineConfig({
  plugins: [react()],
  server: {
    host,
    port,
    strictPort: Boolean(process.env.PORT),
    // Live reload on its own port, on the same host as the site.
    hmr: hmrPort ? { host, port: hmrPort } : undefined,
  },
})
