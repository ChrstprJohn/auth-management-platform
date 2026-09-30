import { auditRepository } from './audit.repository.js'
import { page } from '../../lib/validation.js'
export const auditService = {
  async list(pageInput: unknown, limitInput: unknown) {
    const currentPage = page(pageInput), limit = page(limitInput, 20, 100)
    const rows = await auditRepository.list(currentPage, limit)
    return { data: rows.slice(0, limit), page: currentPage, hasMore: rows.length > limit }
  },
}
