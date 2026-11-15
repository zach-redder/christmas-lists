/**
 * 4-digit PINs, stored only as salted scrypt hashes.
 * A PIN is small, so the real protection is the wrong-try lockout in auth.ts;
 * hashing just keeps PINs (which people reuse) out of the database in plain text.
 */
import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 32;
const PREFIX = "s1";

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, KEY_LENGTH);
  return [PREFIX, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [prefix, salt, hash] = stored.split("$");
  if (prefix !== PREFIX || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(pin, Buffer.from(salt, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Short fingerprint of a stored PIN hash; sessions carry it, so a new or reset PIN ends old sessions. */
export function pinStamp(pinHash: string): string {
  return createHash("sha256").update(pinHash).digest("hex").slice(0, 16);
}
