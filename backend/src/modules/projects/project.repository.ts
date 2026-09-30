import { prisma } from '../../db/prisma.js'
import type { NewProject } from '../../models/project.js'

export const projectRepository = {
  update(id: string, data: Partial<NewProject>, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.update({ where: { id }, data })
      await tx.auditEvent.create({ data: { actorId, action: 'project.update', targetId: id } })
      return project
    })
  },
  delete(id: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.delete({ where: { id } })
      await tx.auditEvent.create({ data: { actorId, action: 'project.delete', targetId: id } })
      return project
    })
  },
  create(data: NewProject, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data })
      await tx.auditEvent.create({
        data: { actorId, action: 'project.create', targetId: project.id },
      })
      return project
    })
  },

  findById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { memberships: true } } },
    })
  },

  async list(limit: number, cursor?: string) {
    const rows = await prisma.project.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { _count: { select: { memberships: true } } },
    })

    const hasMore = rows.length > limit
    const data = rows.slice(0, limit)
    return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null }
  },
}
