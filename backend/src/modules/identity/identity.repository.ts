import { prisma } from '../../db/prisma.js'
export const identityRepository = {
  admin(id: string) {
    return prisma.dashboardAdmin.findUnique({ where: { gotrueUserId: id } })
  },
}
