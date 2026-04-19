/**
 * Jest Configuration for softbits-admin
 *
 * Vite + React + TypeScript project using ts-jest for transform.
 */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: [
    '**/src/__tests__/**/*.test.{ts,tsx}',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'commonjs',
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        noImplicitAny: false,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        skipLibCheck: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 10000,
};
