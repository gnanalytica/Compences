import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appleClientSecret } from '../src/lib/apple';

describe('appleClientSecret', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const config = {
    teamId: 'TEAM123456',
    keyId: 'KEY1234567',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    clientId: 'com.compences.app',
  };
  const jwt = appleClientSecret(config, 1_700_000_000);
  const [header, payload, signature] = jwt.split('.') as [string, string, string];
  const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());

  it('names the key and the team the way Apple asks', () => {
    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'KEY1234567', typ: 'JWT' });
    expect(decode(payload)).toEqual({
      iss: 'TEAM123456',
      iat: 1_700_000_000,
      exp: 1_700_000_300,
      aud: 'https://appleid.apple.com',
      sub: 'com.compences.app',
    });
  });

  it('is signed in the raw r||s form, and verifies', () => {
    expect(Buffer.from(signature, 'base64url')).toHaveLength(64);
    const ok = createVerify('SHA256')
      .update(`${header}.${payload}`)
      .verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
    expect(ok).toBe(true);
  });
});
