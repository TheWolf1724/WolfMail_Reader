import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [
      react(),
      {
        // Politica de contenido solo en produccion: en desarrollo Vite necesita scripts en linea para HMR.
        name: 'csp',
        transformIndexHtml: {
          order: 'pre',
          handler(html: string, ctx: { server?: unknown }) {
            const csp = ctx.server
              ? ''
              : `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: wolfmail-att: https: http:; font-src 'self' data:; frame-src about: data:; connect-src 'none'; base-uri 'none'; form-action 'none'" />`
            return html.replace('<!--CSP-->', csp)
          }
        }
      }
    ],
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } }
  }
})
