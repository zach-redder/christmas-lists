/**
 * WHO YOU ARE: joining with a PIN, signing in with a PIN (with lockout), session checks,
 * and the admin PIN reset. Never touches items or claims.
 */
import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "./db-types";
import { FAMILIES, type FamilyId } from "./families";
import { hashPin, isValidPin, pinStamp, verifyPin } from "./pin";
import { users } from "./schema";
import { createUser, isUuid, type PublicUser } from "./users";

const MAX_WRONG_TRIES = 5;
const LOCK_MINUTES = 15;

export type SignedIn = { ok: true; user: PublicUser; stamp: string };
export type AuthFailure = { ok: false; message: string };

const fail = (message: string): AuthFailure => ({ ok: false, message });

function checkNewPin(pin: string, confirm: string): AuthFailure | null {
  if (!isValidPin(pin)) return fail("Your PIN needs to be exactly 4 numbers.");
  if (pin !== confirm) return fail("Those two PINs don't match. Try again.");
  return null;
}

async function findMember(db: DB, family: FamilyId, userId: string) {
  if (!isUuid(userId)) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      pinHash: users.pinHash,
      pinLockedUntil: users.pinLockedUntil,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.family, family)));
  return row ?? null;
}

/** The person whose name was tapped, and whether they still need to choose a PIN. */
export async function getSignInTarget(
  db: DB,
  family: FamilyId,
  userId: string,
): Promise<{ user: PublicUser; hasPin: boolean } | null> {
  const m = await findMember(db, family, userId);
  return m ? { user: { id: m.id, name: m.name }, hasPin: m.pinHash !== null } : null;
}

export type JoinResult = SignedIn | AuthFailure | { ok: false; taken: PublicUser };

export async function joinWithPin(
  db: DB,
  family: FamilyId,
  name: string,
  pin: string,
  confirm: string,
): Promise<JoinResult> {
  const bad = checkNewPin(pin, confirm);
  if (bad) return bad;
  const pinHash = await hashPin(pin);
  const result = await createUser(db, family, name, pinHash);
  if (result.ok) return { ok: true, user: result.user, stamp: pinStamp(pinHash) };
  return result.reason === "taken" ? { ok: false, taken: result.user } : fail(result.message);
}

function lockMessage(until: Date): string {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export async function signInWithPin(db: DB, family: FamilyId, userId: string, pin: string): Promise<SignedIn | AuthFailure> {
  const m = await findMember(db, family, userId);
  if (!m) return fail("That person wasn't found. Pick your name again.");
  if (!m.pinHash) return fail("You haven't picked a PIN yet.");
  // Reserve this try BEFORE checking the PIN, in one statement that also enforces the lock.
  // Postgres re-checks the WHERE clause on the locked row, so a burst of simultaneous guesses
  // gets at most MAX_WRONG_TRIES reservations; the rest find the name locked.
  const now = new Date();
  const nowSql = sql`${now.toISOString()}::timestamptz`;
  const lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
  // an expired lock means the count starts over
  const newCount = sql`(CASE WHEN ${users.pinLockedUntil} IS NOT NULL THEN 1 ELSE ${users.failedPinAttempts} + 1 END)`;
  const [reserved] = await db
    .update(users)
    .set({
      failedPinAttempts: newCount,
      pinLockedUntil: sql`CASE WHEN ${newCount} >= ${MAX_WRONG_TRIES} THEN ${lockUntil.toISOString()}::timestamptz ELSE NULL END`,
    })
    .where(and(eq(users.id, m.id), sql`(${users.pinLockedUntil} IS NULL OR ${users.pinLockedUntil} <= ${nowSql})`))
    .returning({ lockedUntil: users.pinLockedUntil });
  if (!reserved) {
    const [row] = await db.select({ lockedUntil: users.pinLockedUntil }).from(users).where(eq(users.id, m.id));
    return fail(lockMessage(row?.lockedUntil ?? lockUntil));
  }

  if (isValidPin(pin) && (await verifyPin(pin, m.pinHash))) {
    await db
      .update(users)
      .set({ failedPinAttempts: 0, pinLockedUntil: null, lastSeenAt: new Date() })
      .where(eq(users.id, m.id));
    return { ok: true, user: { id: m.id, name: m.name }, stamp: pinStamp(m.pinHash) };
  }

  if (reserved.lockedUntil) return fail(lockMessage(reserved.lockedUntil));
  return fail("That PIN isn't right. Try again.");
}

/** First-time PIN for someone who joined before PINs existed (or whose PIN was reset). */
export async function setFirstPin(
  db: DB,
  family: FamilyId,
  userId: string,
  pin: string,
  confirm: string,
): Promise<SignedIn | AuthFailure> {
  const bad = checkNewPin(pin, confirm);
  if (bad) return bad;
  if (!isUuid(userId)) return fail("That person wasn't found. Pick your name again.");
  const pinHash = await hashPin(pin);
  // "pin_hash IS NULL" makes this a one-time action: an existing PIN can never be overwritten here.
  const [row] = await db
    .update(users)
    .set({ pinHash, failedPinAttempts: 0, pinLockedUntil: null, lastSeenAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.family, family), isNull(users.pinHash)))
    .returning({ id: users.id, name: users.name });
  if (!row) return fail("This person already has a PIN. Enter it instead.");
  return { ok: true, user: row, stamp: pinStamp(pinHash) };
}

/** The signed-in person, only if the session was made with their current PIN. */
export async function sessionUser(
  db: DB,
  family: FamilyId,
  userId: string,
  stamp: string | undefined,
): Promise<PublicUser | null> {
  if (!stamp) return null;
  const m = await findMember(db, family, userId);
  if (!m?.pinHash || pinStamp(m.pinHash) !== stamp) return null;
  return { id: m.id, name: m.name };
}

export type AdminPerson = { id: string; name: string; family: FamilyId; hasPin: boolean; locked: boolean };

export async function adminListPeople(db: DB): Promise<AdminPerson[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      nameKey: users.nameKey,
      family: users.family,
      pinHash: users.pinHash,
      pinLockedUntil: users.pinLockedUntil,
    })
    .from(users);
  const order = (f: string) => FAMILIES.findIndex((x) => x.id === f);
  return rows
    .sort((a, b) => order(a.family) - order(b.family) || a.nameKey.localeCompare(b.nameKey))
    .map((r) => ({
      id: r.id,
      name: r.name,
      family: r.family as FamilyId,
      hasPin: r.pinHash !== null,
      locked: !!r.pinLockedUntil && r.pinLockedUntil.getTime() > Date.now(),
    }));
}

/** Clears a PIN: the person picks a new one at next sign-in, and all their devices are signed out. */
export async function adminResetPin(db: DB, userId: string): Promise<void> {
  if (!isUuid(userId)) return;
  await db
    .update(users)
    .set({ pinHash: null, failedPinAttempts: 0, pinLockedUntil: null })
    .where(eq(users.id, userId));
}
