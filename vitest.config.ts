import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // tests/e2e はPlaywright for Electron（実起動E2E、`npm run test:e2e`）専用の
    // テストスイートであり、Vitest（jsdom）では実行しない（TASK-034）。
    // Vitestのデフォルト除外パターンに tests/e2e を追加する形で明示指定する。
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.{idea,git,cache,output,temp}/**',
      'tests/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main/index.ts',
        'src/preload/index.ts',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/renderer/src/main.tsx',
        'src/renderer/src/types/**',
        'src/renderer/src/components/ScoreRenderer/osmd-controller.ts',
        'src/renderer/src/components/SettingsModal/index.tsx',
      ],
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 80,
        statements: 75,
      },
    },
  },
});
