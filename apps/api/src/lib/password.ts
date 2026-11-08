import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// When the email doesn't exist, we still run one bcrypt comparison,
// so the response time doesn't reveal which emails are registered.
let dummyHash: Promise<string> | undefined;

export async function verifyAgainstDummy(plain: string) {
  dummyHash ??= bcrypt.hash('timing-protection-dummy', env.BCRYPT_ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
}
