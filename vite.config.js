import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: '/Espotifay/',
  define: { __APP_VERSION__: JSON.stringify(version) }
})
