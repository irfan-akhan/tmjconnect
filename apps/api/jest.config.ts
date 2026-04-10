import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
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
