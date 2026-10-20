import { defineConfig } from 'vitest/config';

// Each test file migrates an in-memory Postgres on first use, which can take a few seconds on a
// busy CI runner.
export default defineConfig({
  test: { testTimeout: 20_000, hookTimeout: 20_000 },
});
