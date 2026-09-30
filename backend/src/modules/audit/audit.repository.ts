import { prisma } from '../../db/prisma.js'
export const auditRepository = {
  list(page: number, limit: number) {
    return prisma.auditEvent.findMany({
      skip: (page - 1) * limit,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  },
}
