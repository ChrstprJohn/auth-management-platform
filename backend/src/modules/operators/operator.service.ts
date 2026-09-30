import { operatorRepository } from './operator.repository.js'
import { uuid, page } from '../../lib/validation.js'
import { gotrueAdmin, type AuthUser } from '../../integrations/gotrue.js'
export const operatorService = {
  async list(pageInput: unknown, limitInput: unknown) {
    const currentPage = page(pageInput), limit = page(limitInput, 20, 100)
    const rows = await operatorRepository.list(currentPage, limit)
    return { data: rows.slice(0, limit), page: currentPage, hasMore: rows.length > limit }
  },
  async grant(id: unknown, actorId: string) {
    const userId = uuid(id)
    await gotrueAdmin<AuthUser>(`/users/${userId}`)
    return operatorRepository.grant(userId, uuid(actorId))
  },
  revoke(id: unknown, actorId: string) { return operatorRepository.revoke(uuid(id), uuid(actorId)) },
}
