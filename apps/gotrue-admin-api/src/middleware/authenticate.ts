import type { RequestHandler } from 'express';
import type { OperatorAuthService } from '../modules/operator-auth/operator-auth.service.js';

export class AuthenticateMiddleware {
  constructor(
    private readonly auth: OperatorAuthService,
    private readonly cookieName: string,
  ) {}
  handle: RequestHandler = async (req, res, next) => {
    const cookies: unknown = req.cookies;
    const cookie: unknown =
      typeof cookies === 'object' && cookies !== null
        ? Reflect.get(cookies, this.cookieName)
        : undefined;
    res.locals.operatorSession = await this.auth.authenticate(cookie);
    next();
  };
}
