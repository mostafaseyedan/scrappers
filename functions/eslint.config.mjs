import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// Flat config version – remove legacy .eslintrc.js when this is active.
export default [
  // 1. Ignore build + generated artifacts
  { ignores: ["lib/**", "generated/**", "eslint.config.mjs"] },

  // 2. Base JS recommended rules applied to all JS/TS source files
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["tsconfig.json", "tsconfig.dev.json"],
        sourceType: "module",
        ecmaVersion: "latest",
      },
      globals: {
        // Node globals
        process: "readonly",
        console: "readonly",
        // Runtime high-resolution timer (Cloud Functions Node 18+ / 20+ / 22+)
        performance: "readonly",
        // fetch is available in Node 18+ experimental and 21+ stable; Node 22 used per engines
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      quotes: ["error", "double"],
      indent: ["error", 2],
    },
  },
];
