import { prisma } from '../../db/prisma.js'
import { gotrueAdmin, gotrueRecovery, type AuthUser } from '../../integrations/gotrue.js'
import { HttpError } from '../../middleware/error-handler.js'

export const userRepository = {
  recovery(email: string) {
    return gotrueRecovery(email)
  },
  list(page: number, limit: number) {
    return gotrueAdmin<{ users: AuthUser[]; total?: number }>(
      `/users?page=${page}&per_page=${limit}`
    )
  },
  get(id: string) {
    return gotrueAdmin<AuthUser>(`/users/${id}`)
  },
  create(data: Record<string, unknown>) {
    return gotrueAdmin<AuthUser>('/users', 'POST', data)
  },
  update(id: string, data: Record<string, unknown>) {
    return gotrueAdmin<AuthUser>(`/users/${id}`, 'PUT', data)
  },
  async delete(id: string) {
    try {
      await gotrueAdmin(`/users/${id}`, 'DELETE')
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) throw error
    }
    // No distributed transaction: retries must also be able to remove stale local rows.
    await prisma.projectMembership.deleteMany({ where: { gotrueUserId: id } })
  },
  memberships(id: string) {
    return prisma.projectMembership.findMany({
      where: { gotrueUserId: id },
      include: { project: true },
    })
  },
  admin(id: string) {
    return prisma.dashboardAdmin.findUnique({ where: { gotrueUserId: id } })
  },
  audit(actorId: string, action: string, targetId: string) {
    return prisma.auditEvent.create({ data: { actorId, action, targetId } })
  },
}
