import { createHmac } from 'node:crypto';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  generateLocalAdminToken,
  writeAdminToken,
} from './local-admin-token.js';

const secret = 'test-only-signing-secret-with-at-least-32-bytes';
const upstream = `GOTRUE_JWT_SECRET=${secret}\nGOTRUE_JWT_ADMIN_ROLES=service_role\nGOTRUE_JWT_AUD=authenticated\n`;
const backend = 'NODE_ENV=development\nGOTRUE_URL=http://localhost:8081\n';
describe('local token setup', () => {
  it('signs the service role with the configured key and bounded expiry', () => {
    const token = generateLocalAdminToken(upstream, backend, 1000);
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) throw new Error('Expected JWT');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'HS256',
      typ: 'JWT',
    });
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({
      role: 'service_role',
      aud: 'authenticated',
      iat: 1000,
      exp: 1000 + 30 * 86400,
    });
    expect(signature).toBe(
      createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url'),
    );
    expect(token).not.toContain(secret);
  });
  it('rejects production, remote URLs, missing secrets and unconfigured admin roles', () => {
    expect(() =>
      generateLocalAdminToken(
        upstream,
        backend.replace('development', 'production'),
      ),
    ).toThrow('local development');
    expect(() =>
      generateLocalAdminToken(
        upstream,
        backend.replace('localhost', 'example.test'),
      ),
    ).toThrow('loopback');
    expect(() => generateLocalAdminToken('', backend)).toThrow(
      'GOTRUE_JWT_SECRET',
    );
    expect(() =>
      generateLocalAdminToken(
        upstream.replace('service_role', 'other_role'),
        backend,
      ),
    ).toThrow('service_role');
  });
  it('preserves other credentials, CRLF and comments while updating only the token', () => {
    const source =
      '# local settings\r\nADMIN_DATABASE_URL=postgresql://role:password@localhost/admin_local_db\r\nGOTRUE_ADMIN_TOKEN=REPLACE_WITH_GOTRUE_ADMIN_TOKEN\r\nGOTRUE_ADMIN_TOKEN=duplicate\r\n';
    const updated = writeAdminToken(source, 'new-token');
    expect(updated).toContain(
      'ADMIN_DATABASE_URL=postgresql://role:password@localhost/admin_local_db\r\n',
    );
    expect(updated).toContain('# local settings\r\n');
    expect(parseEnv(updated).GOTRUE_ADMIN_TOKEN).toBe('new-token');
    expect(updated.match(/GOTRUE_ADMIN_TOKEN=/g)).toHaveLength(1);
  });
});
