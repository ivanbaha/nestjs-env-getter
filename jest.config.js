module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    ".+\\.ts$": ["<rootDir>/test-utils/ts-jest-transformer.cjs", { compiler: "ts-compiler" }],
  },
  collectCoverageFrom: ["**/*.ts"],
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test-utils/envs.mock.ts"],
  coverageDirectory: "../coverage",
  coveragePathIgnorePatterns: [".module.ts", ".mock.ts", "<rootDir>/index.ts", "configuration.ts", "typings.ts"],
};
