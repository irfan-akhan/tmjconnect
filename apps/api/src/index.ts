import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { createContainer } from './config/container';
import { createRateLimiters } from './middleware/rateLimiter';
import { createRequestLogger } from './middleware/requestLogger';
import { createErrorHandler } from './middleware/errorHandler';
import { requestTimeout } from './middleware/requestTimeout';
import { attachDb } from './middleware/audit';
import { authRouter } from './routes/auth';
import { patientsRouter } from './routes/patients';
import { symptomsRouter } from './routes/symptoms';
import { exercisesRouter } from './routes/exercises';
import { notificationsRouter } from './routes/notifications';
import { remindersRouter } from './routes/reminders';
import { providersRouter } from './routes/providers';
import { uploadsRouter } from './routes/uploads';
import { reportsRouter } from './routes/reports';
import { linkingRouter } from './routes/linking';
import { adminRouter } from './routes/admin';
import { trackingRouter } from './routes/tracking';
import { intakeFormsRouter } from './routes/intake-forms';
import { supportRouter } from './routes/support';
import { registerJobs } from './jobs';
import { API_PREFIX, SHUTDOWN_DRAIN_TIMEOUT_MS } from './config/constants';
import { sql } from 'drizzle-orm';
import { initSentry } from './config/sentry';

// ─── Bootstrap ────────────────────────────────────────────────────────────────────
async function bootstrap() {
  const container = await createContainer();
  const { db, pool, logger, env } = container;

  // Initialise Sentry as early as possible (after env, before routes).
  initSentry(env, logger);

  const app = express();

  // ─── Trust proxy (required for correct req.ip behind Nginx/ALB) ─────────────────
  app.set('trust proxy', 1);

  // ─── Security headers ──────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: true,
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
    }),
  );

  // ─── CORS ──────────────────────────────────────────────────────────────────────
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
  const enforceCorsAllowlist = allowedOrigins.length > 0;
  app.use(
    cors({
      origin: (origin, callback) => {
        // Temporary rollout mode: if ALLOWED_ORIGINS is not set, allow all origins.
        // TODO: Remove this branch and enforce allowlist-only once all clients are final.
        if (!enforceCorsAllowlist) {
          callback(null, true);
          return;
        }

        // Allow requests with no origin (mobile apps, curl, etc.).
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );

  // ─── Request parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // ─── Request timeout (before rate limiter) ──────────────────────────────────────
  app.use(requestTimeout);

  // ─── Request logging (pino-http) + X-Request-ID ─────────────────────────────────
  app.use(createRequestLogger(logger));

  // ─── Rate limiting (general tier on all routes) ─────────────────────────────────
  const rateLimiters = createRateLimiters(pool);
  app.use(rateLimiters.general);

  // ─── Attach db + logger to req for audit middleware ─────────────────────────────
  app.use(attachDb(db, logger));

  // ─── Swagger UI (gated by ENABLE_DOCS) ───────────────────────────────────────
  if (env.ENABLE_DOCS) {
    const swaggerUi = require('swagger-ui-express');
    const YAML = require('yamljs');
    const specPath = path.resolve(__dirname, '../../../docs/openapi.yaml');
    const spec = YAML.load(specPath);
    // Temporary docs-only security override.
    // Remove this once the initial rollout is finished and Swagger UI is either
    // disabled again in production or served with a stricter, tested policy.
    app.use(
      '/docs',
      (_req, res, next) => {
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('Cross-Origin-Embedder-Policy');
        res.removeHeader('Cross-Origin-Opener-Policy');
        res.removeHeader('Cross-Origin-Resource-Policy');
        res.removeHeader('Origin-Agent-Cluster');
        next();
      },
    );
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, {
      customSiteTitle: 'TMJConnect API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
    }));
    logger.info('Swagger UI available at /docs');
  }

  // ─── Health check (unauthenticated, no rate limit bypass needed) ────────────────
  app.get('/health', async (_req, res) => {
    try {
      await Promise.race([
        db.execute(sql`SELECT 1`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: { database: 'ok', uptime: process.uptime() },
      });
    } catch {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: { database: 'failed' },
      });
    }
  });

  // ─── API routes ────────────────────────────────────────────────────────────────
  // Auth routes with tighter rate limits (covers both /patient/* and /provider/* paths).
  app.use(`${API_PREFIX}/auth/patient/login`, rateLimiters.auth);
  app.use(`${API_PREFIX}/auth/provider/login`, rateLimiters.auth);
  app.use(`${API_PREFIX}/auth/admin/login`, rateLimiters.auth);
  app.use(`${API_PREFIX}/auth/patient/register`, rateLimiters.auth);
  app.use(`${API_PREFIX}/auth/provider/register`, rateLimiters.auth);
  app.use(`${API_PREFIX}/auth/forgot-password`, rateLimiters.auth);
  app.use(`${API_PREFIX}/auth/mfa`, rateLimiters.mfa);
  app.use(`${API_PREFIX}/auth/reset-password`, rateLimiters.passwordReset);
  app.use(`${API_PREFIX}/auth/verify-email`, rateLimiters.emailVerify);
  app.use(`${API_PREFIX}/auth/resend-verify-email`, rateLimiters.emailVerify);
  // PHI export is a full dump — slow-tier it (5/hour/IP) separately from the general limiter.
  app.use(`${API_PREFIX}/patients/me/export`, rateLimiters.dataExport);

  app.use(`${API_PREFIX}/auth`, authRouter(container));

  // ─── Sprint 2 routes ───────────────────────────────────────────────────────────
  app.use(`${API_PREFIX}/patients`, patientsRouter(container));
  app.use(`${API_PREFIX}/symptoms`, symptomsRouter(container));
  app.use(`${API_PREFIX}/exercises`, exercisesRouter(container));
  app.use(`${API_PREFIX}/notifications`, notificationsRouter(container));
  app.use(`${API_PREFIX}/reminders`, remindersRouter(container));

  // ─── Sprint 3 routes ───────────────────────────────────────────────────────────
  app.use(`${API_PREFIX}/providers`, providersRouter(container));
  app.use(`${API_PREFIX}/uploads`, uploadsRouter(container));

  // ─── Static serve of locally-stored uploads ─────────────────────────────────
  // When STORAGE_DRIVER=local, files written under UPLOAD_DIR are served from
  // /uploads/* (no /api/v1 prefix — the storage driver returns these URLs).
  // In production nginx serves this dir directly with read-only access; this
  // express handler is for local dev where nginx isn't in front of the API.
  if (container.env.STORAGE_DRIVER === 'local') {
    app.use(
      '/uploads',
      express.static(path.resolve(container.env.UPLOAD_DIR), {
        index: false,
        fallthrough: false,
      }),
    );
  }

  // ─── Sprint 4 routes ───────────────────────────────────────────────────────────
  app.use(`${API_PREFIX}/reports`, reportsRouter(container));
  app.use(`${API_PREFIX}/linking`, linkingRouter(container));

  // ─── Sprint 5 routes ───────────────────────────────────────────────────────────
  app.use(`${API_PREFIX}/admin`, adminRouter(container));

  // ─── Tracking routes (mobility, medications, sleep) ──────────────────────────
  app.use(`${API_PREFIX}/tracking`, trackingRouter(container));

  // ─── Intake forms (provider-built questionnaires) ──────────────────────────
  app.use(`${API_PREFIX}/intake-forms`, intakeFormsRouter(container));

  // ─── Support tickets (provider help & support) ─────────────────────────────
  app.use(`${API_PREFIX}/support`, supportRouter(container));

  // ─── 404 fallthrough ───────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'The requested resource does not exist.' },
    });
  });

  // ─── Global error handler (must be last) ───────────────────────────────────────
  app.use(createErrorHandler(logger));

  // ─── Start server ──────────────────────────────────────────────────────────────
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'TMJConnect API started');
  });

  // ─── Startup connectivity check ────────────────────────────────────────────────
  db.execute(sql`SELECT 1`)
    .then(() => {
      logger.info('Database connection verified');
      // Register scheduled jobs after DB is confirmed reachable.
      registerJobs(container);
    })
    .catch((err) => {
      logger.fatal({ err }, 'Cannot connect to database — shutting down');
      process.exit(1);
    });

  // ─── Graceful shutdown (SIGTERM) ───────────────────────────────────────────────
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — starting graceful shutdown');

    server.close(() => {
      logger.info('HTTP server closed — no new connections accepted');
      pool.end(() => {
        logger.info('Database pool closed — exiting');
        process.exit(0);
      });
    });

    // Force exit after drain timeout if in-flight requests haven't completed.
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_DRAIN_TIMEOUT_MS);
  });

  return app;
}

bootstrap().catch((err) => {
  console.error('Fatal: failed to start TMJConnect API', err);
  process.exit(1);
});
