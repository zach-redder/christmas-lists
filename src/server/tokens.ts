/**
 * Signed cookie tokens. No Next.js imports, so this works in proxy.ts, server code, and tests.
 */
import { jwtVerify, SignJWT } from "jose";
import { DEFAULT_FAMILY_ID, FAMILIES, getFamily, type Family, type FamilyId } from "./families";

export const FAMILY_COOKIE = "rc_family";
export const SESSION_COOKIE = "rc_session";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";

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

const normalizePasscode = (value: string) => value.trim().toLowerCase();

/** A family's password, or null when it isn't configured (that family simply can't get in). */
function passcodeFor(family: Family): string | null {
  const value = process.env[family.passcodeEnv] || (isProd() ? undefined : family.devPasscode);
  const normalized = value ? normalizePasscode(value) : "";
  return normalized || null;
}

/** Which family a typed password belongs to, if any. */
export function familyForPasscode(input: string): Family | null {
  const typed = normalizePasscode(input);
  if (!typed) return null;
  return FAMILIES.find((f) => passcodeFor(f) === typed) ?? null;
}

/** Fingerprint of a family's password: changing it signs that family's devices out of the gate. */
async function passcodeStamp(family: Family): Promise<string | null> {
  const passcode = passcodeFor(family);
  if (!passcode) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passcode));
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

export async function signFamilyToken(familyId: FamilyId): Promise<string> {
  const family = getFamily(familyId);
  const stamp = family ? await passcodeStamp(family) : null;
  if (!family || !stamp) throw new Error(`Family "${familyId}" has no password configured.`);
  return sign({ fam: stamp, fid: family.id });
}

/** The family this device was let in for, or null. */
export async function verifyFamilyToken(token: string | undefined): Promise<FamilyId | null> {
  const payload = await verify(token);
  // Cookies issued before there were several families carry no family id: they belong to the original one.
  const family = getFamily(payload?.fid ?? (payload?.fam ? DEFAULT_FAMILY_ID : undefined));
  if (!family) return null;
  const stamp = await passcodeStamp(family);
  return stamp && payload?.fam === stamp ? family.id : null;
}

export async function signSessionToken(userId: string): Promise<string> {
  return sign({ sub: userId });
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  const payload = await verify(token);
  return typeof payload?.sub === "string" ? payload.sub : null;
}
