// Jest configuration. The project is native ESM ("type": "module"), so we run
// under Node's experimental VM modules (set in the npm "test" script) and use
// no transform — Jest loads the ES modules directly. An in-memory MongoDB is
// started by tests/setup.js and torn down between/after tests.

export default {
  testEnvironment: 'node',
  // No Babel/transform — rely on native ESM execution.
  transform: {},
  // Per-file DB lifecycle + cleanup helpers.
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // mongodb-memory-server may download a binary on first run.
  testTimeout: 30000,
  // Surface open handles if something forgets to close.
  detectOpenHandles: true,
  forceExit: true,
};
