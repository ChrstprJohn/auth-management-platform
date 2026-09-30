import { HttpError } from '../../middleware/error-handler.js'
import { projectRepository, type NewProject } from './project.repository.js'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseProjectInput(value: unknown): NewProject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_input', 'A JSON object is required')
  }

  const input = value as Record<string, unknown>
  const slug = input.slug
  const name = input.name
  const description = input.description

  if (typeof slug !== 'string' || slug.length > 63 || !slugPattern.test(slug)) {
    throw new HttpError(400, 'invalid_slug', 'slug must be 1–63 lowercase letters, numbers, or single hyphens')
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    throw new HttpError(400, 'invalid_name', 'name must be 1–120 characters')
  }
  if (description !== undefined && description !== null &&
      (typeof description !== 'string' || description.trim().length > 500)) {
    throw new HttpError(400, 'invalid_description', 'description must be at most 500 characters')
  }

  return {
    slug,
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() || null : null,
  }
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new HttpError(400, 'invalid_id', 'A valid project UUID is required')
  }
  return value
}

export const projectService = {
  create(input: unknown) {
    return projectRepository.create(parseProjectInput(input))
  },

  async get(id: unknown) {
    const project = await projectRepository.findById(parseUuid(id))
    if (!project) throw new HttpError(404, 'project_not_found', 'Project not found')
    return project
  },

  list(limitInput: unknown, cursorInput: unknown) {
    const limit = limitInput === undefined ? 20 : Number(limitInput)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new HttpError(400, 'invalid_limit', 'limit must be an integer from 1 to 100')
    }
    const cursor = cursorInput === undefined ? undefined : parseUuid(cursorInput)
    return projectRepository.list(limit, cursor)
  },
}
