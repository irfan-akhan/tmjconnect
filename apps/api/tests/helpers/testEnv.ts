/**
 * Test environment variables.
 * Set before importing any module that reads from process.env (including config/env.ts).
 * Call setupTestEnv() at the top of test files or in a global setup file.
 */
export function setupTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://tmjconnect:test_password@127.0.0.1:5433/tmjconnect_test';
  process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_xxxxxxxx';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_at_least_32_characters_yyyyyy';
  process.env.MFA_ENCRYPTION_KEY = '0'.repeat(64); // 64-char hex string for tests
  process.env.ALLOWED_ORIGINS = 'http://localhost:8081';
  process.env.PORT = '3001';
  process.env.LOG_LEVEL = 'error';
  process.env.STORAGE_DRIVER = 'local';
  process.env.UPLOAD_DIR = '/tmp/tmjconnect-test-uploads';
  process.env.APP_URL = 'http://localhost:8081';
  process.env.API_URL = 'http://localhost:3001';
}
