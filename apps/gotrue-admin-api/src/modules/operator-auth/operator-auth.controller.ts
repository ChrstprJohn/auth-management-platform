import type { Request, Response, CookieOptions } from 'express';
import type { OperatorAuthService } from './operator-auth.service.js';
import { loginSchema } from './operator-auth.schemas.js';
import { ApiError } from '../../shared/errors/api-error.js';

export class OperatorAuthController {
  readonly cookieName: string;
  private readonly cookieOptions: CookieOptions;
  constructor(
    private readonly service: OperatorAuthService,
    production: boolean,
  ) {
    this.cookieName = production
      ? '__Host-operator_session'
      : 'operator_session';
    this.cookieOptions = {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
    };
  }
  login = async (req: Request, res: Response): Promise<void> => {
    if (!req.is('application/json'))
      throw new ApiError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Use application/json.',
      );
    const input = loginSchema.safeParse(req.body);
    if (!input.success)
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid request input.');
    const result = await this.service.login(
      input.data.email,
      input.data.password,
    );
    res.cookie(this.cookieName, result.cookie, {
      ...this.cookieOptions,
      expires: new Date(result.session.expiresAt),
    });
    res.json(result.session);
  };
  me = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.authenticate(this.readCookie(req)));
  };
  logout = async (req: Request, res: Response): Promise<void> => {
    await this.service.logout(this.readCookie(req));
    res.clearCookie(this.cookieName, this.cookieOptions);
    res.status(204).end();
  };
  private readCookie(req: Request): unknown {
    const cookies: unknown = req.cookies;
    if (
      typeof cookies !== 'object' ||
      cookies === null ||
      !(this.cookieName in cookies)
    )
      return undefined;
    return Reflect.get(cookies, this.cookieName);
  }
}
