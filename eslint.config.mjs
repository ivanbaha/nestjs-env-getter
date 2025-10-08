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
      "prettier/prettier": "warn",

      "no-console": "warn",
      "no-prototype-builtins": "off",

      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",

      "jsdoc/check-alignment": "warn",
      "jsdoc/require-description": "warn",
      "jsdoc/require-description-complete-sentence": "warn",
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-name": "warn",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-hyphen-before-param-description": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/require-returns-type": "off",
      "jsdoc/require-throws": "warn",
      "jsdoc/check-tag-names": "warn",
      "jsdoc/no-bad-blocks": "warn",
      "jsdoc/sort-tags": "warn",
      "jsdoc/require-throws-type": "off",
    },
  },
  { languageOptions: { globals: globals.node } },
  {
    files: ["examples/**/*.{js,mjs,cjs,ts}"],
    rules: {
      "jsdoc/require-jsdoc": "off",
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
];
