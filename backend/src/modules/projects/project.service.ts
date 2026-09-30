import { HttpError } from '../../middleware/error-handler.js'
import { projectRepository } from './project.repository.js'
import type { NewProject } from '../../models/project.js'
import { objectInput, uuid, page } from '../../lib/validation.js'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function enrollmentPolicy(value: unknown): 'open' | 'closed' {
  if (value !== 'open' && value !== 'closed')
    throw new HttpError(400, 'invalid_policy', 'Enrollment policy must be open or closed')
  return value
}

function parseProjectInput(value: unknown): NewProject {
  const input = objectInput(value)
  const slug = input.slug
  const name = input.name
  const description = input.description

  if (typeof slug !== 'string' || slug.length > 63 || !slugPattern.test(slug)) {
    throw new HttpError(
      400,
      'invalid_slug',
      'slug must be 1–63 lowercase letters, numbers, or single hyphens'
    )
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    throw new HttpError(400, 'invalid_name', 'name must be 1–120 characters')
  }
  if (
    description !== undefined &&
    description !== null &&
    (typeof description !== 'string' || description.trim().length > 500)
  ) {
    throw new HttpError(400, 'invalid_description', 'description must be at most 500 characters')
  }

  return {
    slug,
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() || null : null,
    enrollmentPolicy:
      input.enrollmentPolicy === undefined ? 'closed' : enrollmentPolicy(input.enrollmentPolicy),
  }
}

export const projectService = {
  async update(id: unknown, input: unknown, actorId: string) {
    const existing = await this.get(id)
    const value = objectInput(input)
    const allowed = ['slug', 'name', 'description', 'enrollmentPolicy']
    if (!Object.keys(value).length || Object.keys(value).some((key) => !allowed.includes(key))) {
      throw new HttpError(400, 'invalid_input', 'Provide project fields to update')
    }
    return projectRepository.update(
      existing.id,
      parseProjectInput({ ...existing, ...value }),
      actorId
    )
  },
  async delete(id: unknown, actorId: string) {
    const existing = await this.get(id)
    return projectRepository.delete(existing.id, actorId)
  },
  create(input: unknown, actorId: string) {
    return projectRepository.create(parseProjectInput(input), actorId)
  },

  async get(id: unknown) {
    const project = await projectRepository.findById(uuid(id))
    if (!project) throw new HttpError(404, 'project_not_found', 'Project not found')
    return project
  },

  list(limitInput: unknown, cursorInput: unknown) {
    const limit = page(limitInput, 20, 100)
    const cursor = cursorInput === undefined ? undefined : uuid(cursorInput)
    return projectRepository.list(limit, cursor)
  },
}
