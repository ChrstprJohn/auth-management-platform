import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  allowVerifiedOperator,
  localOperatorConfig,
  operatorInputSchema,
} from './local-operator.js';

const operatorId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const environment =
  'NODE_ENV=development\r\nGOTRUE_URL=http://localhost:8081\r\nADMIN_DATABASE_URL=preserved\r\nOPERATOR_UUID_ALLOWLIST=00000000-0000-4000-8000-000000000001\r\n';
const identity = { id: operatorId, email_confirmed_at: '2026-09-30T00:00:00Z' };

describe('local operator provisioning boundaries', () => {
  it('refuses production, remote upstreams and malformed existing operators', () => {
    expect(() =>
      localOperatorConfig(environment.replace('development', 'production')),
    ).toThrow();
    expect(() =>
      localOperatorConfig(environment.replace('localhost', 'example.test')),
    ).toThrow();
    expect(() =>
      localOperatorConfig(
        environment.replace(
          '00000000-0000-4000-8000-000000000001',
          'not-a-uuid',
        ),
      ),
    ).toThrow();
  });
  it('requires a confirmed, unbanned valid identity before changing authority', () => {
    expect(() =>
      allowVerifiedOperator(environment, { id: operatorId }),
    ).toThrow();
    expect(() =>
      allowVerifiedOperator(environment, { ...identity, id: 'invalid' }),
    ).toThrow();
    expect(() =>
      allowVerifiedOperator(environment, {
        ...identity,
        email_confirmed_at: 'invalid',
      }),
    ).toThrow();
    expect(() =>
      allowVerifiedOperator(
        environment,
        { ...identity, banned_until: '2026-10-02T00:00:00Z' },
        Date.parse('2026-10-01T00:00:00Z'),
      ),
    ).toThrow();
    expect(() =>
      allowVerifiedOperator(environment, {
        ...identity,
        banned_until: 'invalid',
      }),
    ).toThrow();
  });
  it('replaces only the example UUID and preserves credentials, line endings and configured operators', () => {
    const first = allowVerifiedOperator(environment, identity);
    expect(parseEnv(first).OPERATOR_UUID_ALLOWLIST).toBe(operatorId);
    expect(first).toContain('ADMIN_DATABASE_URL=preserved\r\n');
    const next = allowVerifiedOperator(first, { ...identity, id: otherId });
    expect(parseEnv(next).OPERATOR_UUID_ALLOWLIST).toBe(
      `${operatorId},${otherId}`,
    );
    expect(allowVerifiedOperator(next, identity)).toBe(next);
  });
  it('rejects extra fields and passwords exceeding GoTrue UTF-8 byte limits', () => {
    const input = {
      action: 'signup',
      email: 'operator@example.test',
      password: 'controlled-password',
    };
    expect(operatorInputSchema.safeParse(input).success).toBe(true);
    expect(
      operatorInputSchema.safeParse({ ...input, role: 'admin' }).success,
    ).toBe(false);
    expect(
      operatorInputSchema.safeParse({ ...input, password: '😀'.repeat(19) })
        .success,
    ).toBe(false);
  });
});
