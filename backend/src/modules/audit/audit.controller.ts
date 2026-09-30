import type { RequestHandler } from 'express'
import { auditService } from './audit.service.js'
export const listAudit: RequestHandler = async (request, response) => {
  response.json(await auditService.list(request.query.page, request.query.limit))
}
