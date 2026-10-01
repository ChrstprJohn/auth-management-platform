import { z } from 'zod';
export const newPasswordSchema = z
  .string()
  .min(8)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72);
