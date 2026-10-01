import { z } from 'zod';
import { isIP } from 'node:net';

const csv = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((item) => item.trim()));
const origin = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Expected an exact HTTP(S) origin without a path');
const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().default('127.0.0.1'),
    GOTRUE_ADMIN_TOKEN: z.string().min(1),
    ALLOW_GLOBAL_USER_DELETION: z
      .enum(['false', 'true'])
      .default('false')
      .transform((value) => value === 'true'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3100),
    GOTRUE_URL: z.url().refine((value) => {
      if (!URL.canParse(value)) return false;
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    }),
    ADMIN_DATABASE_URL: z
      .url()
      .refine(
        (value) =>
          URL.canParse(value) &&
          ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      ),
    OPERATOR_UUID_ALLOWLIST: csv
      .pipe(z.array(z.uuid()).min(1))
      .transform((items) => new Set(items.map((item) => item.toLowerCase()))),
    SESSION_ENCRYPTION_KEY: z
      .string()
      .regex(/^[A-Za-z0-9+/]{43}=$/)
      .transform((value) => Buffer.from(value, 'base64'))
      .refine((value) => value.length === 32),
    FRONTEND_ORIGINS: csv.pipe(z.array(origin).min(1)),
    RECOVERY_CALLBACK_URL: z
      .url()
      .default('http://localhost:3100/v1/operator/auth/recovery/callback'),
    RECOVERY_RESET_URL: z.url().default('http://localhost:5173/reset-password'),
    UPSTREAM_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(30000)
      .default(5000),
    DATABASE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(30000)
      .default(5000),
    TRUST_PROXY: z
      .string()
      .default('false')
      .refine(
        (value) =>
          value === 'false' ||
          value.split(',').every((entry) => {
            const [address, prefix] = entry.trim().split('/');
            if (!address || !isIP(address)) return false;
            return (
              prefix === undefined ||
              (/^\d+$/.test(prefix) &&
                Number(prefix) <= (isIP(address) === 4 ? 32 : 128))
            );
          }),
      ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, context) => {
    if (
      !URL.canParse(value.RECOVERY_CALLBACK_URL) ||
      !URL.canParse(value.RECOVERY_RESET_URL)
    )
      return;
    const callback = new URL(value.RECOVERY_CALLBACK_URL);
    const reset = new URL(value.RECOVERY_RESET_URL);
    for (const [name, url] of [
      ['RECOVERY_CALLBACK_URL', callback],
      ['RECOVERY_RESET_URL', reset],
    ] as const) {
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (value.NODE_ENV === 'production' &&
          (url.protocol !== 'https:' ||
            !(
              url.hostname === 'chrbuilds.dev' ||
              url.hostname.endsWith('.chrbuilds.dev')
            )))
      )
        context.addIssue({
          code: 'custom',
          path: [name],
          message:
            'Expected a trusted HTTP(S) URL without credentials, query or fragment',
        });
    }
    if (callback.pathname !== '/v1/operator/auth/recovery/callback')
      context.addIssue({
        code: 'custom',
        path: ['RECOVERY_CALLBACK_URL'],
        message: 'Expected the recovery gateway callback path',
      });
    if (!value.FRONTEND_ORIGINS.includes(reset.origin))
      context.addIssue({
        code: 'custom',
        path: ['RECOVERY_RESET_URL'],
        message: 'Reset page must use a configured frontend origin',
      });
    if (value.NODE_ENV !== 'production') return;
    for (const item of value.FRONTEND_ORIGINS) {
      if (!URL.canParse(item)) continue;
      const url = new URL(item);
      if (
        url.protocol !== 'https:' ||
        !(
          url.hostname === 'chrbuilds.dev' ||
          url.hostname.endsWith('.chrbuilds.dev')
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['FRONTEND_ORIGINS'],
          message: 'Production requires HTTPS same-site chrbuilds.dev origins',
        });
      }
    }
  });

export type Config = z.infer<typeof schema>;
export function loadConfig(environment: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(environment);
  if (!result.success) {
    // Never include rejected environment values in startup output.
    throw new Error(
      `Invalid configuration fields: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  }
  return result.data;
}
