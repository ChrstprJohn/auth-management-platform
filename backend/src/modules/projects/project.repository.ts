import { prisma } from '../../db/prisma.js'

export interface NewProject {
  slug: string
  name: string
  description: string | null
  enrollmentPolicy?: string
}

export const projectRepository = {
  update(id: string, data: Partial<NewProject>) {
    return prisma.project.update({ where: { id }, data })
  },
  delete(id: string) {
    return prisma.project.delete({ where: { id } })
  },
  create(data: NewProject) {
    return prisma.project.create({ data })
  },

  findById(id: string) {
    return prisma.project.findUnique({ where: { id }, include: { _count: { select: { memberships: true } } } })
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
    return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null }
  },
}
