import { z } from 'zod';
export const emailSchema = z.email('Enter a valid email address.').max(254);
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(1024),
});
export const newPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Use at most 72 UTF-8 bytes.',
  );
export function safeReturn(value: string | null) {
  return value &&
    /^\/(users(?:\/(?:new|invite|[0-9a-fA-F-]{36}))?|dashboard|history(?:\/[0-9a-fA-F-]{36})?|status|account)(?:\?page=\d+&perPage=\d+)?$/.test(
      value,
    )
    ? value
    : '/users';
}
