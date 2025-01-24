import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,ts}"],

    ignores: ["node_modules/", "dist/"],

    languageOptions: {
      globals: globals.browser,
    },

    // plugins: ["@typescript-eslint", "@nestjs", "prettier"],
    plugins: {
      jsdoc: jsdoc,
    },

    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:@nestjs/recommended",
      "plugin:prettier/recommended", // Enables Prettier rules
    ],

    rules: {
      // Prettier integration
      "prettier/prettier": "warn",

      // TypeScript-specific rules
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",

      // NestJS-specific rules
      "@nestjs/use-lifecycle-interface": "warn",
      "@nestjs/use-validation-pipe": "warn",

      // General JS/TS rules
      "no-console": "warn",
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
        },
      ],
    },
  },
];
