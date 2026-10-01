import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';
const valid = {
  GOTRUE_ADMIN_TOKEN: 'test-admin-token',
  GOTRUE_URL: 'http://localhost:8081',
  ADMIN_DATABASE_URL: 'postgresql://unused:secret@localhost/admin_test',
  OPERATOR_UUID_ALLOWLIST: '00000000-0000-4000-8000-000000000001',
  SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  FRONTEND_ORIGINS: 'http://localhost:5173',
};
describe('configuration', () => {
  it('rejects unsafe keys, wildcard origins, arbitrary proxy trust and malformed UUIDs without leaking values', () => {
    for (const override of [
      { SESSION_ENCRYPTION_KEY: 'secret' },
      { FRONTEND_ORIGINS: '*' },
      { TRUST_PROXY: 'true' },
      { OPERATOR_UUID_ALLOWLIST: 'secret' },
      { RECOVERY_CALLBACK_URL: 'secret' },
      { RECOVERY_CALLBACK_URL: 'http://localhost:3100/not-the-callback' },
      {
        RECOVERY_CALLBACK_URL:
          'http://localhost:3100/v1/operator/auth/recovery/callback?redirect=secret',
      },
      { RECOVERY_RESET_URL: 'https://untrusted.test/reset-password' },
      { RECOVERY_RESET_URL: 'javascript:secret' },
    ]) {
      expect(() => loadConfig({ ...valid, ...override })).toThrow(
        'Invalid configuration fields:',
      );
      try {
        loadConfig({ ...valid, ...override });
      } catch (error) {
        expect(String(error)).not.toContain('secret');
      }
    }
  });
  it('requires production same-site HTTPS origins and explicit trusted proxy addresses', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: 'production' })).toThrow();
    expect(
      loadConfig({
        ...valid,
        NODE_ENV: 'production',
        FRONTEND_ORIGINS: 'https://admin.chrbuilds.dev',
        RECOVERY_CALLBACK_URL:
          'https://admin-api.chrbuilds.dev/v1/operator/auth/recovery/callback',
        RECOVERY_RESET_URL: 'https://admin.chrbuilds.dev/reset-password',
        TRUST_PROXY: '172.20.0.0/16',
      }).TRUST_PROXY,
    ).toBe('172.20.0.0/16');
  });
});
