import { prisma } from '../../db/prisma.js'
import { HttpError } from '../../middleware/error-handler.js'

export const operatorRepository = {
  list(page: number, limit: number) {
    return prisma.dashboardAdmin.findMany({
      skip: (page - 1) * limit,
      take: limit + 1,
      orderBy: { gotrueUserId: 'asc' },
    })
  },
  grant(userId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admin = await tx.dashboardAdmin.upsert({
        where: { gotrueUserId: userId },
        create: { gotrueUserId: userId },
        update: {},
      })
      await tx.auditEvent.create({ data: { actorId, action: 'operator.grant', targetId: userId } })
      return admin
    })
  },
  revoke(userId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`LOCK TABLE dashboard.dashboard_admins IN EXCLUSIVE MODE`
      if (!(await tx.dashboardAdmin.findUnique({ where: { gotrueUserId: userId } })))
        throw new HttpError(404, 'operator_not_found', 'Dashboard administrator not found')
      if ((await tx.dashboardAdmin.count()) <= 1)
        throw new HttpError(409, 'last_admin', 'The last dashboard administrator cannot be removed')
      await tx.dashboardAdmin.delete({ where: { gotrueUserId: userId } })
      await tx.auditEvent.create({ data: { actorId, action: 'operator.revoke', targetId: userId } })
    })
  },
}
