import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: rootDir },
      { find: "server-only", replacement: fileURLToPath(new URL("./tests/mocks/server-only.ts", import.meta.url)) },
    ],
  },
});