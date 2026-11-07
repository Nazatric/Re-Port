import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": path.resolve(dir, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
