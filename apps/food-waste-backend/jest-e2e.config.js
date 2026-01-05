module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".e2e-spec.ts$", // matches your auth-token.e2e-spec.ts
  transform: {
    "^.+\\.(t|j)s$": "ts-jest", // transpile TS for Jest
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  coverageDirectory: "./coverage-e2e",
  testTimeout: 60000,
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1", // allow absolute imports like src/users
  },
};
