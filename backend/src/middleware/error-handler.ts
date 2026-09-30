import type { ErrorRequestHandler } from 'express'
import { Prisma } from '../generated/prisma/client.js'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    response
      .status(409)
      .json({ error: { code: 'conflict', message: 'This record already exists' } })
    return
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    response.status(404).json({ error: { code: 'not_found', message: 'Record not found' } })
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response
      .status(400)
      .json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON' } })
    return
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    response
      .status(413)
      .json({ error: { code: 'body_too_large', message: 'Request body is too large' } })
    return
  }

  console.error('Unhandled API error', error)
  response.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } })
}
