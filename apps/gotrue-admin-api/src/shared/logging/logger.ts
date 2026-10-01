import pino from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: [
        'password',
        'access_token',
        'refresh_token',
        'token',
        'cookie',
        'authorization',
        'req.headers',
        'req.body',
        'res.headers',
        'err.config',
        'err.request',
        'err.response',
      ],
      censor: '[REDACTED]',
    },
  });
}
