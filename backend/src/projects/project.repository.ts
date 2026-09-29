import { prisma } from '../db/prisma.js'

export interface NewProject {
  slug: string
  name: string
  description: string | null
}

export const projectRepository = {
  create(data: NewProject) {
    return prisma.project.create({ data })
  },

  findById(id: string) {
    return prisma.project.findUnique({ where: { id } })
  },

  async list(limit: number, cursor?: string) {
    const rows = await prisma.project.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    const hasMore = rows.length > limit
    const data = rows.slice(0, limit)
    return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null }
  },
}
