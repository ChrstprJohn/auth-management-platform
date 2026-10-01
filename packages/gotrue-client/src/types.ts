import { z } from 'zod';

export const identitySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  email_confirmed_at: z.string().nullable().optional(),
  banned_until: z.string().nullable().optional(),
});
export type Identity = z.infer<typeof identitySchema>;
export interface PasswordSession {
  accessToken: string;
  expiresAt: number;
  user: Identity;
}
export interface OperatorIdentityClient {
  passwordLogin(email: string, password: string): Promise<PasswordSession>;
  getIdentity(accessToken: string): Promise<Identity>;
  health(): Promise<{ version: string }>;
}
