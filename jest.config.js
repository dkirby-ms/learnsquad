/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(pixi\\.js|pixi-viewport|@pixi)/)',
  ],
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/auth.test.ts', '<rootDir>/src/__tests__/oauth.test.ts'],
      preset: 'ts-jest',
    },
    {
      displayName: 'server-tests',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/tests/**/*.test.ts'],
      preset: 'ts-jest',
      roots: ['<rootDir>/server'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/*.integration.test.ts'],
      preset: 'ts-jest',
      forceExit: true,
    },
    {
      displayName: 'game',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/game/__tests__/**/*.test.ts'],
      preset: 'ts-jest',
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/components/**/*.test.tsx'],
      preset: 'ts-jest',
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(pixi\\.js|pixi-viewport|@pixi)/)',
      ],
    },
  ],
};
