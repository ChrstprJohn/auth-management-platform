import { membershipRepository } from './membership.repository.js'
import { projectService } from '../projects/project.service.js'
import { gotrueAdmin, publicUser, type AuthUser } from '../../integrations/gotrue.js'
import { objectInput, uuid, page } from '../../lib/validation.js'
import { HttpError } from '../../middleware/error-handler.js'

export const membershipService = {
  mine(userId: string) { return membershipRepository.mine(uuid(userId)) },
  async access(projectId: unknown, userId: string) {
    const project = await projectService.get(projectId)
    const membership = await membershipRepository.get(project.id, uuid(userId))
    return { projectId: project.id, allowed: Boolean(membership), role: membership?.role ?? null }
  },
  async enroll(projectId: unknown, userId: string, body: unknown) {
    const input = body === undefined ? {} : objectInput(body)
    if (Object.keys(input).length) throw new HttpError(400, 'invalid_input', 'Enrollment does not accept user IDs or roles')
    const result = await membershipRepository.enroll(uuid(projectId), uuid(userId))
    if (result.status === 'missing') throw new HttpError(404, 'project_not_found', 'Project not found')
    if (result.status === 'closed') throw new HttpError(403, 'enrollment_closed', 'Ask a project administrator to grant access')
    return result.membership
  },
  async list(projectId: unknown, pageInput: unknown, limitInput: unknown) {
    const project = await projectService.get(projectId)
    const currentPage = page(pageInput)
    const limit = page(limitInput, 20, 100)
    const rows = await membershipRepository.list(project.id, currentPage, limit)
    // Membership IDs remain useful when an account was deleted outside this backend.
    const data = await Promise.all(rows.slice(0, limit).map(async membership => {
      try {
        const user = publicUser(await gotrueAdmin<AuthUser>(`/users/${membership.gotrueUserId}`))
        return { ...membership, user }
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return { ...membership, user: null }
        throw error
      }
    }))
    return { data, page: currentPage, hasMore: rows.length > limit }
  },
  async assign(projectId: unknown, userId: unknown, body: unknown, actorId: string) {
    const project = await projectService.get(projectId)
    const id = uuid(userId)
    const input = objectInput(body)
    if (Object.keys(input).some(key => key !== 'role')) throw new HttpError(400, 'invalid_input', 'Only role can be assigned')
    const role = input.role ?? 'member'
    if (role !== 'member' && role !== 'manager') throw new HttpError(400, 'invalid_role', 'Role must be member or manager')
    await gotrueAdmin<AuthUser>(`/users/${id}`)
    return membershipRepository.assign(project.id, id, role, uuid(actorId))
  },
  async remove(projectId: unknown, userId: unknown, actorId: string) {
    await projectService.get(projectId)
    return membershipRepository.remove(uuid(projectId), uuid(userId), uuid(actorId))
  },
}
