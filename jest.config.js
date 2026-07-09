module.exports = {
  moduleDirectories: ["node_modules", "<rootDir>/src"],
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
};
