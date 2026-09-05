import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/serverOnlyStub.ts'),
      // El prefijo va ANTES del exacto: si no, '@domain/billingCatalog' cae en
      // el alias de index.ts y vitest se queda sin resolver el subcamino.
      '@domain/': path.resolve(__dirname, './packages/domain/src') + '/',
      '@domain': path.resolve(__dirname, './packages/domain/src/index.ts'),
    },
  },
});
