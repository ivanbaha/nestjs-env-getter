module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    ".+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.ts"],
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test-utils/envs.mock.ts"],
  coverageDirectory: "../coverage",
  coveragePathIgnorePatterns: [".module.ts", ".mock.ts", "<rootDir>/index.ts", "configuration.ts", "typings.ts"],
};
