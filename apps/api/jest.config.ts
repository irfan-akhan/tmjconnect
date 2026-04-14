import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.test.json',
        // 151002: "hybrid module kind requires isolatedModules". Setting that
        // flag breaks Jest's CommonJS handling of dynamic imports, so we suppress
        // the warning instead.
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  moduleNameMapper: {
    '@tmjconnect/shared': '<rootDir>/../../packages/shared/src',
  },
  setupFiles: ['<rootDir>/tests/helpers/jestSetup.ts'],
  setupFilesAfterEnv: [],
  // Run tests serially — they share a real test database
  maxWorkers: 1,
  testTimeout: 30000,
};

export default config;
