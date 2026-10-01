import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Express } from 'express';
import type { Logger } from 'pino';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { Pool } from 'pg';
import {
  GoTrueClient,
  GoTrueAdminClient,
  type AdminUsersClient,
  type OperatorIdentityClient,
} from '@auth/gotrue-client';
import type { Config } from './config/env.js';
import { createLogger } from './shared/logging/logger.js';
import {
  SessionRepository,
  type SessionStore,
} from './modules/operator-auth/session.repository.js';
import { SessionCrypto } from './modules/operator-auth/session-crypto.js';
import { OperatorAuthService } from './modules/operator-auth/operator-auth.service.js';
import { OperatorAuthController } from './modules/operator-auth/operator-auth.controller.js';
import { HealthService } from './modules/health/health.service.js';
import { HealthController } from './modules/health/health.controller.js';
import { CsrfMiddleware } from './middleware/csrf.js';
import { errorHandler } from './middleware/error-handler.js';
import { ApiError, forbidden } from './shared/errors/api-error.js';
import { AuthenticateMiddleware } from './middleware/authenticate.js';
import {
  AuditRepository,
  type AuditStore,
} from './modules/audit/audit.repository.js';
import { AuditService } from './modules/audit/audit.service.js';
import { AuditController } from './modules/audit/audit.controller.js';
import {
  MutationLockRepository,
  type MutationLock,
} from './modules/users/mutation-lock.repository.js';
import { UsersService } from './modules/users/users.service.js';
import { UsersController } from './modules/users/users.controller.js';

export interface AppDependencies {
  upstream?: OperatorIdentityClient;
  sessions?: SessionStore;
  checkDatabase?: () => Promise<void>;
  admin?: AdminUsersClient;
  audit?: AuditStore;
  mutationLock?: MutationLock;
}
export function createApp(
  config: Config,
  dependencies: AppDependencies = {},
): { app: Express; logger: Logger; close: () => Promise<void> } {
  const logger = createLogger(config.LOG_LEVEL);
  const pool = new Pool({
    connectionString: config.ADMIN_DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: config.DATABASE_TIMEOUT_MS,
    query_timeout: config.DATABASE_TIMEOUT_MS,
    statement_timeout: config.DATABASE_TIMEOUT_MS,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', () =>
    logger.error(
      { code: 'DATABASE_CONNECTION_ERROR' },
      'Database connection failed',
    ),
  );
  const upstream =
    dependencies.upstream ??
    new GoTrueClient(config.GOTRUE_URL, config.UPSTREAM_TIMEOUT_MS);
  const sessions = dependencies.sessions ?? new SessionRepository(pool);
  const authService = new OperatorAuthService(
    upstream,
    sessions,
    new SessionCrypto(config.SESSION_ENCRYPTION_KEY),
    config.OPERATOR_UUID_ALLOWLIST,
  );
  const auth = new OperatorAuthController(
    authService,
    config.NODE_ENV === 'production',
  );
  const authenticate = new AuthenticateMiddleware(authService, auth.cookieName);
  const auditService = new AuditService(
    dependencies.audit ?? new AuditRepository(pool),
  );
  const audit = new AuditController(auditService);
  const users = new UsersController(
    new UsersService(
      dependencies.admin ??
        new GoTrueAdminClient(
          config.GOTRUE_URL,
          config.UPSTREAM_TIMEOUT_MS,
          config.GOTRUE_ADMIN_TOKEN,
        ),
      auditService,
      dependencies.mutationLock ?? new MutationLockRepository(pool),
      authService,
      config.OPERATOR_UUID_ALLOWLIST,
      config.ALLOW_GLOBAL_USER_DELETION,
    ),
  );
  const health = new HealthController(
    new HealthService(
      upstream,
      dependencies.checkDatabase ??
        (async () => {
          // Check the owned table too; SELECT 1 alone would hide an unapplied schema.
          await pool.query(
            'SELECT session_hash FROM operator_sessions LIMIT 0',
          );
          await pool.query('SELECT id FROM management_audit LIMIT 0');
        }),
    ),
  );
  const csrf = new CsrfMiddleware(config.FRONTEND_ORIGINS);
  const app = express();
  app.disable('x-powered-by');
  app.set(
    'trust proxy',
    config.TRUST_PROXY === 'false'
      ? false
      : config.TRUST_PROXY.split(',').map((value) => value.trim()),
  );
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set('X-Request-ID', res.locals.requestId);
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => String(res.getHeader('X-Request-ID')),
      serializers: {
        req: (req: { id: unknown; method: unknown }) => ({
          id: req.id,
          method: req.method,
        }),
        res: (res: { statusCode: unknown }) => ({ statusCode: res.statusCode }),
        err: () => ({ code: 'HTTP_ERROR' }),
      },
      customProps: (_req, res) => ({
        requestId: res.getHeader('X-Request-ID'),
      }),
    }),
  );
  app.use(helmet());
  app.use((req, _res, next) => {
    const origin = req.get('Origin');
    next(
      origin && !config.FRONTEND_ORIGINS.includes(origin)
        ? forbidden()
        : undefined,
    );
  });
  app.use(
    cors({
      origin: config.FRONTEND_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Protection'],
      exposedHeaders: ['X-Request-ID'],
    }),
  );
  const limiter = (limit: number, windowMs: number) =>
    rateLimit({
      limit,
      windowMs,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Try again later.',
          },
          requestId: res.locals.requestId,
        });
      },
    });
  app.use(limiter(300, 60000));
  app.use(cookieParser());
  app.get('/health/live', health.live);
  app.get('/health/ready', health.ready);
  app.post(
    '/v1/operator/auth/login',
    csrf.handle,
    limiter(10, 15 * 60000),
    express.json({ limit: '16kb', strict: true }),
    auth.login,
  );
  app.get('/v1/operator/auth/me', auth.me);
  app.post('/v1/operator/auth/logout', csrf.handle, auth.logout);
  const usersRouter = express.Router();
  usersRouter.use(authenticate.handle);
  usersRouter.get('/', users.list);
  usersRouter.get('/:id', users.get);
  const jsonBody = express.json({ limit: '16kb', strict: true });
  usersRouter.post('/', csrf.handle, jsonBody, users.create);
  usersRouter.post('/:id/ban', csrf.handle, jsonBody, users.ban);
  usersRouter.post('/:id/unban', csrf.handle, jsonBody, users.unban);
  usersRouter.delete('/:id', csrf.handle, jsonBody, users.delete);
  app.use('/v1/operator/users', usersRouter);
  app.get('/v1/operator/audit', authenticate.handle, audit.list);
  app.get('/v1/operator/health', authenticate.handle, health.upstream);
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'Route not found.')),
  );
  app.use(errorHandler(logger));
  return { app, logger, close: () => pool.end() };
}
