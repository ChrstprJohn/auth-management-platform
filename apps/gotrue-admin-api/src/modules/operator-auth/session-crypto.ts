import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export interface EncryptedToken {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
}
export class SessionCrypto {
  constructor(private readonly key: Buffer) {}
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
  hash(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex');
  }
  encrypt(token: string, operatorId: string): EncryptedToken {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from(operatorId));
    return {
      ciphertext: Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]),
      nonce,
      tag: cipher.getAuthTag(),
    };
  }
  decrypt(token: EncryptedToken, operatorId: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, token.nonce);
    decipher.setAAD(Buffer.from(operatorId));
    decipher.setAuthTag(token.tag);
    return Buffer.concat([
      decipher.update(token.ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}
