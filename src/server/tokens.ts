/**
 * Signed cookie tokens. No Next.js imports, so this works in proxy.ts, server code, and tests.
 */
import { jwtVerify, SignJWT } from "jose";
import { DEFAULT_FAMILY_ID, FAMILIES, getFamily, type Family, type FamilyId } from "./families";

export const FAMILY_COOKIE = "rc_family";
export const SESSION_COOKIE = "rc_session";
export const ADMIN_COOKIE = "rc_admin";
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 12;
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

async function sign(claims: Record<string, string>, maxAgeSeconds = COOKIE_MAX_AGE_SECONDS): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
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

/** `pin` is a fingerprint of the person's PIN when they signed in; a changed or reset PIN ends the session. */
export async function signSessionToken(userId: string, pinStamp: string): Promise<string> {
  return sign({ sub: userId, pin: pinStamp });
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<{ userId: string; pinStamp: string | undefined } | null> {
  const payload = await verify(token);
  if (typeof payload?.sub !== "string") return null;
  return { userId: payload.sub, pinStamp: typeof payload.pin === "string" ? payload.pin : undefined };
}

// ---------- Admin (PIN resets) ----------

/** The admin password, or null when unset in production (the admin page is then closed). */
function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD || (isProd() ? undefined : "admin");
  return value ? value : null;
}

async function adminStamp(): Promise<string | null> {
  const pw = adminPassword();
  if (!pw) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`admin:${pw}`));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function checkAdminPassword(input: string): boolean {
  const pw = adminPassword();
  return pw !== null && input === pw;
}

export async function signAdminToken(): Promise<string> {
  const stamp = await adminStamp();
  if (!stamp) throw new Error("ADMIN_PASSWORD is not set.");
  return sign({ adm: stamp }, ADMIN_MAX_AGE_SECONDS);
}

export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  const stamp = await adminStamp();
  if (!stamp) return false;
  return (await verify(token))?.adm === stamp;
}
