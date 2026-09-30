import { userRepository } from './user.repository.js'
import { publicUser } from '../../integrations/gotrue.js'
import { uuid, objectInput, page, text } from '../../lib/validation.js'
import { HttpError } from '../../middleware/error-handler.js'

function userInput(value: unknown, creating: boolean): Record<string, unknown> {
  const input = objectInput(value)
  const allowed = ['email', 'password', 'email_confirm']
  if (!Object.keys(input).length || Object.keys(input).some(key => !allowed.includes(key))) {
    throw new HttpError(400, 'invalid_input', 'Provide email, password or email_confirm only')
  }
  const data: Record<string, unknown> = {}
  if (creating || input.email !== undefined) {
    const email = text(input.email, 'email', 254)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid_email', 'A valid email is required')
    data.email = email
  }
  if (creating || input.password !== undefined) {
    if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) {
      throw new HttpError(400, 'invalid_password', 'Password must be 12–128 characters')
    }
    data.password = input.password
  }
  if (input.email_confirm !== undefined) {
    if (typeof input.email_confirm !== 'boolean') throw new HttpError(400, 'invalid_input', 'email_confirm must be boolean')
    data.email_confirm = input.email_confirm
  }
  return data
}

export const userService = {
  async list(pageInput: unknown, limitInput: unknown) {
    const currentPage = page(pageInput), limit = page(limitInput, 20, 100)
    const result = await userRepository.list(currentPage, limit)
    return { data: result.users.map(publicUser), page: currentPage, hasMore: result.total === undefined ? result.users.length === limit : currentPage * limit < result.total }
  },
  async get(id: unknown) {
    const userId = uuid(id)
    return { ...publicUser(await userRepository.get(userId)), memberships: await userRepository.memberships(userId) }
  },
  async create(input: unknown, actorId: string) {
    const user = await userRepository.create(userInput(input, true))
    await userRepository.audit(actorId, 'user.create', user.id)
    return publicUser(user)
  },
  async update(id: unknown, input: unknown, actorId: string) {
    const userId = uuid(id)
    const user = await userRepository.update(userId, userInput(input, false))
    await userRepository.audit(actorId, 'user.update', userId)
    return publicUser(user)
  },
  async delete(id: unknown, input: unknown, actorId: string) {
    const userId = uuid(id)
    if (objectInput(input).confirmUserId !== userId) throw new HttpError(400, 'confirmation_required', 'Confirm the shared account UUID to delete')
    if (await userRepository.admin(userId)) throw new HttpError(409, 'admin_account', 'Revoke dashboard admin permission before deleting this account')
    await userRepository.delete(userId)
    await userRepository.audit(actorId, 'user.delete', userId)
  },
}
