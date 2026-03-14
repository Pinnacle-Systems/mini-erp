import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/modules/sales/sales-balance.service.ts",
        "src/modules/sales/document-link.service.ts",
      ],
    },
  },
});
