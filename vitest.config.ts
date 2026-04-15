import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Default environment for pure-logic unit tests
    environment: "node",
    // Per-file environment overrides via vitest-environment docblock
    environmentOptions: {},
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "components/**/*.{ts,tsx}"],
      exclude: ["lib/supabase/**", "lib/database.types.ts"],
      thresholds: {
        // Q-21: Start tracking — gradually raise as coverage improves
        statements: 20,
        branches: 15,
        functions: 15,
        lines: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
