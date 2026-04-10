/**
 * Jest setup — runs once before any test file is loaded.
 * Sets test environment variables BEFORE any module that reads from process.env.
 */
import { setupTestEnv } from './testEnv';
setupTestEnv();
