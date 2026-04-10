import { setupTestEnv } from './testEnv';
setupTestEnv();

import express, { type Router } from 'express';
import type { Container } from '../../src/config/container';
import { createTestContainer } from './testContainer';
import { attachDb } from '../../src/middleware/audit';
import { createErrorHandler } from '../../src/middleware/errorHandler';
import { signAccessToken } from '../../src/utils/jwt';
import { API_PREFIX } from '../../src/config/constants';
import type { TestUser } from './factories';

/**
 * Routers map: path → factory. Each factory receives the test container.
 * Paths are relative to API_PREFIX (e.g. '/patients' becomes '/api/v1/patients').
 */
export type RouterFactories = Record<string, (container: Container) => Router>;

/**
 * buildTestApp — minimal Express app wired with the test container, attachDb,
 * the requested routers (under API_PREFIX), and the error handler.
 *
 * Intentionally omits helmet, CORS, request timeout, rate limiting, request logger.
 * Those belong to E2E/load tests; integration tests verify route behaviour.
 */
export function buildTestApp(routers: RouterFactories) {
  const container = createTestContainer();
  const app = express();
  app.use(express.json());
  app.set('trust proxy', 1);
  app.use(attachDb(container.db, container.logger));
  for (const [path, factory] of Object.entries(routers)) {
    app.use(`${API_PREFIX}${path}`, factory(container));
  }
  app.use(createErrorHandler(container.logger));
  return { app, container };
}

/** Mints an access-token Bearer header for a TestUser. */
export function bearerFor(user: TestUser): string {
  const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
  return `Bearer ${token}`;
}
