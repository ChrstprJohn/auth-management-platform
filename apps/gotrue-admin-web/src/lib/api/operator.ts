import { z } from 'zod';
import { api } from './client';
import {
  sessionSchema,
  usersSchema,
  detailSchema,
  mutationSchema,
  deletionSchema,
  historySchema,
  liveSchema,
  readySchema,
  upstreamSchema,
} from './schemas';

const auth = '/v1/operator/auth';
const users = '/v1/operator/users';
export const operatorApi = {
  me: (signal?: AbortSignal) =>
    api.request('GET', `${auth}/me`, sessionSchema, { signal }),
  login: (body: { email: string; password: string }) =>
    api.request('POST', `${auth}/login`, sessionSchema, { body }),
  logout: () => api.request('POST', `${auth}/logout`, z.undefined()),
  forgot: (body: { email: string }) =>
    api.request(
      'POST',
      `${auth}/forgot-password`,
      z.object({ message: z.string() }),
      { body },
    ),
  reset: (body: { password: string }) =>
    api.request('POST', `${auth}/reset-password`, z.undefined(), { body }),
  users: (page: number, perPage: number, signal?: AbortSignal) =>
    api.request(
      'GET',
      `${users}?page=${page}&perPage=${perPage}`,
      usersSchema,
      { signal },
    ),
  user: (id: string, signal?: AbortSignal) =>
    api.request('GET', `${users}/${id}`, detailSchema, { signal }),
  create: (body: {
    email: string;
    password: string;
    confirmation: 'require_verification' | 'operator_confirmed';
  }) => api.request('POST', users, mutationSchema, { body }),
  ban: (id: string, durationHours: number) =>
    api.request('POST', `${users}/${id}/ban`, mutationSchema, {
      body: { targetId: id, durationHours, confirmation: 'BAN_GLOBAL_USER' },
    }),
  unban: (id: string) =>
    api.request('POST', `${users}/${id}/unban`, mutationSchema, {
      body: { targetId: id, confirmation: 'UNBAN_GLOBAL_USER' },
    }),
  delete: (id: string) =>
    api.request('DELETE', `${users}/${id}`, deletionSchema, {
      body: { targetId: id, confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY' },
    }),
  history: (page: number, perPage: number, signal?: AbortSignal) =>
    api.request(
      'GET',
      `/v1/operator/audit?page=${page}&perPage=${perPage}`,
      historySchema,
      { signal },
    ),
  live: (signal?: AbortSignal) =>
    api.request('GET', '/health/live', liveSchema, { signal }),
  ready: (signal?: AbortSignal) =>
    api.request('GET', '/health/ready', readySchema, { signal, health: true }),
  upstream: (signal?: AbortSignal) =>
    api.request('GET', '/v1/operator/health', upstreamSchema, {
      signal,
      health: true,
    }),
};
