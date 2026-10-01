import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Express } from 'express';
import type { Logger } from 'pino';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { createRateLimiter } from './middleware/rate-limit.js';
import { pinoHttp } from 'pino-http';
import { Pool } from 'pg';
import {
  GoTrueClient,
  GoTrueAdminClient,
  GoTrueRecoveryClient,
  type RecoveryClient,
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
import {
  RecoveryRepository,
  type RecoveryStore,
} from './modules/recovery/recovery.repository.js';
import { RecoveryService } from './modules/recovery/recovery.service.js';
import { RecoveryController } from './modules/recovery/recovery.controller.js';

import { createOperatorAuthRoutes } from './modules/operator-auth/operator-auth.routes.js';
import { createRecoveryRoutes } from './modules/recovery/recovery.routes.js';
import { createUsersRoutes } from './modules/users/users.routes.js';
import { createAuditRoutes } from './modules/audit/audit.routes.js';
import { createHealthRoutes } from './modules/health/health.routes.js';
export interface AppDependencies {
  upstream?: OperatorIdentityClient;
  sessions?: SessionStore;
  checkDatabase?: () => Promise<void>;
  admin?: AdminUsersClient;
  audit?: AuditStore;
  mutationLock?: MutationLock;
  recovery?: RecoveryClient;
  recoveryStore?: RecoveryStore;
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
  const recovery = new RecoveryController(
    new RecoveryService(
      dependencies.recovery ??
        new GoTrueRecoveryClient(config.GOTRUE_URL, config.UPSTREAM_TIMEOUT_MS),
      upstream,
      dependencies.recoveryStore ?? new RecoveryRepository(pool),
      new SessionCrypto(config.SESSION_ENCRYPTION_KEY),
      config.OPERATOR_UUID_ALLOWLIST,
      config.RECOVERY_CALLBACK_URL,
    ),
    config.NODE_ENV === 'production',
    config.RECOVERY_RESET_URL,
    auth.cookieName,
  );
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
          await pool.query(
            'SELECT recovery_hash FROM operator_recovery LIMIT 0',
          );
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
  app.use(createRateLimiter(300, 60000));
  app.use(cookieParser());
  app.use(createHealthRoutes(health, authenticate));
  app.use('/v1/operator/auth', createOperatorAuthRoutes(auth, csrf));
  app.use('/v1/operator/auth', createRecoveryRoutes(recovery, csrf));
  app.use('/v1/operator/users', createUsersRoutes(users, authenticate, csrf));
  app.use('/v1/operator/audit', createAuditRoutes(audit, authenticate));
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'Route not found.')),
  );
  app.use(errorHandler(logger));
  return { app, logger, close: () => pool.end() };
}
