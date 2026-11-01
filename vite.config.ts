import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Chemins relatifs (base './') : le dossier dist/ peut être ouvert
// depuis n'importe quel serveur statique local, sans configuration.
export default defineConfig({
  base: './',
  plugins: [vue()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
})
