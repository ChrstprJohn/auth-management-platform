import { HttpError } from '../middleware/error-handler.js'

export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_input', 'A JSON object is required')
  }
  return value as Record<string, unknown>
}

export function uuid(value: unknown): string {
  if (!isUuid(value)) {
    throw new HttpError(400, 'invalid_id', 'A valid UUID is required')
  }
  return value
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

export function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, 'invalid_input', `${name} must be 1–${max} characters`)
  }
  return value.trim()
}

export function page(value: unknown, fallback = 1, max = 100000): number {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new HttpError(400, 'invalid_pagination', 'Invalid pagination value')
  const result = Number(value)
  if (!Number.isInteger(result) || result < 1 || result > max)
    throw new HttpError(400, 'invalid_pagination', 'Pagination value out of range')
  return result
}
