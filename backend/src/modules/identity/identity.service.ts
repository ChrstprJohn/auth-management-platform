import { identityRepository } from './identity.repository.js'
export const identityService = {
  async get(id: string) {
    return { id, isAdmin: Boolean(await identityRepository.admin(id)) }
  },
}
