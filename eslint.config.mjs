import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import prettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  jsdoc.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,cjs,ts}"],

    plugins: {
      jsdoc,
    },

    rules: {
      "no-console": "warn",

      "jsdoc/check-alignment": "warn",
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
  { languageOptions: { globals: globals.node } },
  {
    ignores: ["node_modules/", "dist/"],
  },
];
