/**
 * Signed cookie tokens. No Next.js imports, so this works in proxy.ts, server code, and tests.
 */
import { jwtVerify, SignJWT } from "jose";

export const FAMILY_COOKIE = "rc_family";
export const SESSION_COOKIE = "rc_session";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";
const DEV_PASSCODE = "snowman";

function isProd() {
  return process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DB !== "1";
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? (isProd() ? undefined : DEV_SECRET);
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

function passcode(): string {
  const value = process.env.FAMILY_PASSCODE ?? (isProd() ? undefined : DEV_PASSCODE);
  if (!value) throw new Error("FAMILY_PASSCODE must be set.");
  return normalizePasscode(value);
}

const normalizePasscode = (value: string) => value.trim().toLowerCase();

export function checkPasscode(input: string): boolean {
  return normalizePasscode(input) === passcode();
}

/** Fingerprint of the current passcode: changing the passcode signs every device out of the family gate. */
async function passcodeStamp(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passcode()));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(claims: Record<string, string>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

async function verify(token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function signFamilyToken(): Promise<string> {
  return sign({ fam: await passcodeStamp() });
}

export async function verifyFamilyToken(token: string | undefined): Promise<boolean> {
  const payload = await verify(token);
  return payload?.fam === (await passcodeStamp());
}

export async function signSessionToken(userId: string): Promise<string> {
  return sign({ sub: userId });
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  const payload = await verify(token);
  return typeof payload?.sub === "string" ? payload.sub : null;
}
