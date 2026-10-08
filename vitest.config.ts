import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/backend/**/*.test.ts'],
    environment: 'node',
  },
});
