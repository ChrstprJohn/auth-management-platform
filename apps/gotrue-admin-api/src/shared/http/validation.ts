import { z } from 'zod';
import { ApiError } from '../errors/api-error.js';
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid request input.');
  return result.data;
}
export const paginationSchema = z.strictObject({
  page: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(10000))
    .optional()
    .default(1),
  perPage: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(100))
    .optional()
    .default(20),
});
