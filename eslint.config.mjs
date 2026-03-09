import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const sharedGlobals = {
  ...globals.node,
  ...globals.browser
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/test-results/**",
      "packages/db/drizzle/**",
      "apps/web/tsconfig.tsbuildinfo"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      globals: sharedGlobals
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
