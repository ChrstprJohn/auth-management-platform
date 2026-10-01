import type { Request, Response, CookieOptions } from 'express';
import type { RecoveryRequestResponse } from '@auth/contracts';
import { ApiError } from '../../shared/errors/api-error.js';
import { parseInput } from '../../shared/http/validation.js';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  recoveryCallbackSchema,
} from './recovery.schemas.js';
import type { RecoveryService } from './recovery.service.js';

export class RecoveryController {
  readonly cookieName: string;
  private readonly cookieOptions: CookieOptions;
  constructor(
    private readonly service: RecoveryService,
    production: boolean,
    private readonly resetPage: string,
    private readonly operatorCookieName: string,
  ) {
    this.cookieName = production
      ? '__Host-operator_recovery'
      : 'operator_recovery';
    this.cookieOptions = {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
    };
  }
  private readCookie(req: Request): unknown {
    const cookies: unknown = req.cookies;
    return typeof cookies === 'object' && cookies !== null
      ? Reflect.get(cookies, this.cookieName)
      : undefined;
  }
  private json(req: Request): void {
    if (!req.is('application/json'))
      throw new ApiError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Use application/json.',
      );
  }
  request = async (req: Request, res: Response): Promise<void> => {
    this.json(req);
    const input = parseInput(forgotPasswordSchema, req.body);
    const result = await this.service.request(input.email);
    res.cookie(this.cookieName, result.cookie, {
      ...this.cookieOptions,
      expires: result.expiresAt,
    });
    res.status(202).json({
      message:
        'If the account can be recovered, a recovery email will be sent.',
    } satisfies RecoveryRequestResponse);
  };
  callback = async (req: Request, res: Response): Promise<void> => {
    const input = parseInput(recoveryCallbackSchema, req.query);
    const expiresAt = await this.service.callback(
      this.readCookie(req),
      input.state,
      input.code,
    );
    res.cookie(this.cookieName, this.readCookie(req), {
      ...this.cookieOptions,
      expires: expiresAt,
    });
    res.set('Referrer-Policy', 'no-referrer');
    res.status(303).set('Location', this.resetPage).end();
  };
  reset = async (req: Request, res: Response): Promise<void> => {
    this.json(req);
    const input = parseInput(resetPasswordSchema, req.body);
    await this.service.reset(this.readCookie(req), input.password);
    res.clearCookie(this.cookieName, this.cookieOptions);
    res.clearCookie(this.operatorCookieName, this.cookieOptions);
    res.status(204).end();
  };
}
