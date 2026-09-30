import { prisma } from '../../db/prisma.js'

export const membershipRepository = {
  get(projectId: string, gotrueUserId: string) {
    return prisma.projectMembership.findUnique({
      where: { projectId_gotrueUserId: { projectId, gotrueUserId } },
    })
  },
  mine(gotrueUserId: string) {
    return prisma.projectMembership.findMany({
      where: { gotrueUserId },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    })
  },
  list(projectId: string, page: number, limit: number) {
    return prisma.projectMembership.findMany({
      where: { projectId },
      skip: (page - 1) * limit,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { gotrueUserId: 'desc' }],
    })
  },
  async enroll(projectId: string, gotrueUserId: string) {
    return prisma.$transaction(async (tx) => {
      // Serialize enrollment with policy updates/deletion of the project.
      const projects = await tx.$queryRaw<Array<{ enrollment_policy: string }>>`
        SELECT enrollment_policy FROM dashboard.projects WHERE id = ${projectId}::uuid FOR UPDATE`
      if (!projects.length) return { status: 'missing' as const }
      const existing = await tx.projectMembership.findUnique({
        where: { projectId_gotrueUserId: { projectId, gotrueUserId } },
      })
      if (existing) return { status: 'ok' as const, membership: existing }
      if (projects[0].enrollment_policy !== 'open') return { status: 'closed' as const }
      const membership = await tx.projectMembership.create({
        data: { projectId, gotrueUserId, role: 'member' },
      })
      await tx.auditEvent.create({
        data: { actorId: gotrueUserId, action: 'membership.enroll', targetId: projectId },
      })
      return { status: 'ok' as const, membership }
    })
  },
  assign(projectId: string, gotrueUserId: string, role: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.projectMembership.upsert({
        where: { projectId_gotrueUserId: { projectId, gotrueUserId } },
        create: { projectId, gotrueUserId, role },
        update: { role },
      })
      await tx.auditEvent.create({
        data: { actorId, action: `membership.assign.${role}`, targetId: gotrueUserId },
      })
      return membership
    })
  },
  remove(projectId: string, gotrueUserId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.projectMembership.delete({
        where: { projectId_gotrueUserId: { projectId, gotrueUserId } },
      })
      await tx.auditEvent.create({
        data: { actorId, action: 'membership.remove', targetId: gotrueUserId },
      })
    })
  },
}
