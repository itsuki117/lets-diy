import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { watch: { ignored: ['**/*.tsbuildinfo'] } },
  test: {
    environment: 'jsdom',
    alias: { 'three-bvh-csg': fileURLToPath(new URL('./node_modules/three-bvh-csg/src/index.js', import.meta.url)) },
    setupFiles: ['./src/test/setup.ts'],
    server: { deps: { inline: ['three-bvh-csg', 'three-mesh-bvh'] } },
    coverage: { provider: 'v8', include: ['src/core/**/*.ts'], exclude: ['src/core/types.ts', '**/__tests__/**'], thresholds: { lines: 80 } },
  },
  esbuild: { pure: ['console.debug'] },
  build: { chunkSizeWarningLimit: 1600 },
});
