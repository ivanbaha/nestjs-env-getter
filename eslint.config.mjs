import pluginJs from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    ignores: ["node_modules/", "dist/"],
    plugins: {
      jsdoc,
    },
    rules: {
      "jsdoc/check-alignment": ["warn", "always"],
      "jsdoc/require-description": "warn",
      "jsdoc/require-description-complete-sentence": "warn",
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-hyphen-before-param-description": "warn",
      "jsdoc/require-param-name": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/require-throws": "warn",
      "jsdoc/check-tag-names": "warn",
      "jsdoc/newline-after-description": "warn",
      "jsdoc/no-bad-blocks": "warn",
      "jsdoc/sort-tags": "warn",
      "jsdoc/newline-after-description": "off",
    },
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
