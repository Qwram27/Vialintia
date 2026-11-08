import { resolve } from 'path'
import { fileURLToPath } from 'url'

const root = fileURLToPath(new URL('.', import.meta.url))
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(root, 'src/renderer/src'),
      '@shared': resolve(root, 'src/shared')
    }
  },
  test: { include: ['src/**/*.test.ts'] }
})
