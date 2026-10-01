import type { RequestHandler } from 'express';
import { forbidden } from '../shared/errors/api-error.js';

export class CsrfMiddleware {
  constructor(private readonly origins: readonly string[]) {}
  handle: RequestHandler = (req, _res, next) => {
    if (
      !this.origins.includes(req.get('Origin') ?? '') ||
      req.get('X-CSRF-Protection') !== '1'
    )
      return next(forbidden());
    next();
  };
}
