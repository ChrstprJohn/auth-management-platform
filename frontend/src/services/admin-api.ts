import { api } from './api-client'
import type { Project } from '@/types/project'
import type { Membership, Page, User } from '@/types/user'
import type { DashboardOperator, AuditEvent } from '@/types/admin'
export const adminApi = {
  operators: (page = 1) => api<Page<DashboardOperator>>('/operators?page=' + page),
  grantOperator: (id: string) => api('/operators/' + id, 'PUT'),
  revokeOperator: (id: string) => api<void>('/operators/' + id, 'DELETE'),
  audit: (page = 1) => api<Page<AuditEvent>>('/audit?page=' + page),
  projects: (cursor?: string) =>
    api<{ data: Project[]; nextCursor: string | null }>(
      '/projects?limit=20' + (cursor ? '&cursor=' + cursor : '')
    ),
  project: (id: string) => api<{ data: Project }>('/projects/' + id),
  createProject: (body: unknown) => api<{ data: Project }>('/projects', 'POST', body),
  updateProject: (id: string, body: unknown) =>
    api<{ data: Project }>('/projects/' + id, 'PATCH', body),
  deleteProject: (id: string) => api<void>('/projects/' + id, 'DELETE'),
  members: (id: string, page = 1) =>
    api<Page<Membership>>('/projects/' + id + '/members?page=' + page),
  assign: (id: string, userId: string, role: string) =>
    api('/projects/' + id + '/members/' + userId, 'PUT', { role }),
  remove: (id: string, userId: string) =>
    api<void>('/projects/' + id + '/members/' + userId, 'DELETE'),
  users: (page = 1) => api<Page<User>>('/users?page=' + page),
  user: (id: string) => api<{ data: User }>('/users/' + id),
  createUser: (body: unknown) => api<{ data: User }>('/users', 'POST', body),
  updateUser: (id: string, body: unknown) => api<{ data: User }>('/users/' + id, 'PATCH', body),
  deleteUser: (id: string) => api<void>('/users/' + id, 'DELETE', { confirmUserId: id }),
  recoverUser: (id: string) =>
    api<{ data: { message: string } }>('/users/' + id + '/recovery', 'POST'),
}
