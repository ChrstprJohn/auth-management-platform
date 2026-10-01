import { z } from 'zod';
import { GoTrueHttp } from './http.js';
import { UpstreamError } from './errors.js';

const date = z.string().refine((value) => Number.isFinite(Date.parse(value)));
export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable().optional(),
  created_at: date.nullable().optional(),
  email_confirmed_at: date.nullable().optional(),
  last_sign_in_at: date.nullable().optional(),
  banned_until: date.nullable().optional(),
  deleted_at: date.nullable().optional(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;
export interface AdminUsersClient {
  listUsers(page: number, perPage: number): Promise<AdminUser[]>;
  getUser(id: string): Promise<AdminUser>;
  createUser(
    email: string,
    password: string,
    confirmed: boolean,
  ): Promise<AdminUser>;
  setBan(id: string, duration: string): Promise<AdminUser>;
  deleteUser(id: string): Promise<void>;
}
export class GoTrueAdminClient implements AdminUsersClient {
  private readonly http: GoTrueHttp;
  constructor(
    baseUrl: string,
    timeoutMs: number,
    private readonly adminToken: string,
  ) {
    this.http = new GoTrueHttp(baseUrl, timeoutMs);
  }
  private parseUser(body: unknown, mutation = false): AdminUser {
    const result = adminUserSchema.safeParse(body);
    if (!result.success) throw new UpstreamError('unavailable', mutation);
    return result.data;
  }
  async listUsers(page: number, perPage: number): Promise<AdminUser[]> {
    const result = z
      .object({ users: z.array(adminUserSchema).max(perPage) })
      .safeParse(
        await this.http.request(
          'GET',
          `admin/users?page=${page}&per_page=${perPage}`,
          undefined,
          this.adminToken,
        ),
      );
    if (!result.success) throw new UpstreamError('unavailable');
    return result.data.users;
  }
  async getUser(id: string): Promise<AdminUser> {
    const user = this.parseUser(
      await this.http.request(
        'GET',
        `admin/users/${encodeURIComponent(id)}`,
        undefined,
        this.adminToken,
      ),
    );
    if (user.id.toLowerCase() !== id.toLowerCase())
      throw new UpstreamError('unavailable');
    return user;
  }
  async createUser(
    email: string,
    password: string,
    confirmed: boolean,
  ): Promise<AdminUser> {
    return this.parseUser(
      await this.http.request(
        'POST',
        'admin/users',
        { email, password, email_confirm: confirmed },
        this.adminToken,
      ),
      true,
    );
  }
  async setBan(id: string, duration: string): Promise<AdminUser> {
    const user = this.parseUser(
      await this.http.request(
        'PUT',
        `admin/users/${encodeURIComponent(id)}`,
        { ban_duration: duration },
        this.adminToken,
      ),
      true,
    );
    if (user.id.toLowerCase() !== id.toLowerCase())
      throw new UpstreamError('unavailable', true);
    return user;
  }
  async deleteUser(id: string): Promise<void> {
    await this.http.request(
      'DELETE',
      `admin/users/${encodeURIComponent(id)}`,
      { should_soft_delete: false },
      this.adminToken,
    );
  }
}
