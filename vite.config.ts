import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { watch: { ignored: ['**/*.tsbuildinfo'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: { provider: 'v8', include: ['src/core/**/*.ts'], exclude: ['src/core/types.ts'], thresholds: { lines: 80 } },
  },
  esbuild: { pure: ['console.debug'] },
  build: { chunkSizeWarningLimit: 1600 },
});
