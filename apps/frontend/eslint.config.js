import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir,
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "EventSource",
          message:
            "Server-driven event delivery is intentionally deferred. Revisit ARCHITECTURE.md before introducing EventSource.",
        },
        {
          name: "WebSocket",
          message:
            "Server-driven event delivery is intentionally deferred. Revisit ARCHITECTURE.md before introducing WebSocket.",
        },
        {
          name: "Notification",
          message:
            "Background notification primitives are intentionally deferred. Revisit ARCHITECTURE.md before introducing Notification.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "socket.io-client",
              message:
                "Realtime transport is intentionally deferred. Revisit ARCHITECTURE.md before introducing socket.io-client.",
            },
            {
              name: "web-push",
              message:
                "Web Push is intentionally deferred. Revisit ARCHITECTURE.md before introducing web-push.",
            },
            {
              name: "ws",
              message:
                "Realtime transport is intentionally deferred. Revisit ARCHITECTURE.md before introducing ws.",
            },
          ],
        },
      ],
      "jsx-a11y/control-has-associated-label": "error",
      "jsx-a11y/label-has-associated-control": [
        "error",
        {
          assert: "either",
        },
      ],
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: ["useSessionHydration", "useSyncActions"],
        },
      ],
    },
  },
  {
    files: ["src/pages/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            "Prefer the shared design-system Button or IconButton in pages, routes, and features instead of raw <button> markup.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            "Prefer the shared design-system Input in pages, routes, and features instead of raw <input> markup.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "Prefer the shared design-system Select in pages, routes, and features instead of raw <select> markup.",
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message:
            "Prefer a shared labeled form primitive or wrapper instead of raw <textarea> markup in product surfaces.",
        },
      ],
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/design-system/atoms/Label.tsx"],
    rules: {
      "jsx-a11y/label-has-associated-control": "off",
    },
  },
);
