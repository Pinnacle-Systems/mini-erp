import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "generated/**",
      "node_modules/**",
      "prisma/migrations/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      },
      parserOptions: {
        tsconfigRootDir,
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports"
        }
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "socket.io",
              message:
                "Broad realtime infrastructure is intentionally deferred. Revisit ARCHITECTURE.md before introducing socket.io.",
            },
            {
              name: "socket.io-client",
              message:
                "Broad realtime infrastructure is intentionally deferred. Revisit ARCHITECTURE.md before introducing socket.io-client.",
            },
            {
              name: "web-push",
              message:
                "Web Push is intentionally deferred. Revisit ARCHITECTURE.md before introducing web-push.",
            },
            {
              name: "ws",
              message:
                "Broad realtime infrastructure is intentionally deferred. Revisit ARCHITECTURE.md before introducing ws.",
            }
          ]
        }
      ]
    }
  }
);
