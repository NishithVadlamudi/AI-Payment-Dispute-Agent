import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  ...base,
  test: { fileParallelism: false, include: ['tests/*.integration.test.ts'], exclude: [], testTimeout: 15000 },
});
