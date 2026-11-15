import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getFamily, type Family, type FamilyId } from "./families";
import { sessionUser } from "./auth";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SECONDS,
  COOKIE_MAX_AGE_SECONDS,
  FAMILY_COOKIE,
  SESSION_COOKIE,
  signAdminToken,
  signFamilyToken,
  signSessionToken,
  verifyAdminToken,
  verifyFamilyToken,
  verifySessionToken,
} from "./tokens";
import type { PublicUser } from "./users";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
};

/** The family this device was let in for (via its password), or null. */
export async function currentFamily(): Promise<Family | null> {
  return getFamily(await verifyFamilyToken((await cookies()).get(FAMILY_COOKIE)?.value));
}

export type Me = PublicUser & { family: Family };

/**
 * The signed-in person, verified against the database on every request.
 * Identity ALWAYS comes from the signed cookie, never from URLs or form fields.
 */
export async function requireUser(): Promise<Me> {
  const family = await currentFamily();
  if (!family) redirect("/welcome");
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  // Only a session made with this person's current PIN, in the device's family, counts.
  const user = session ? await sessionUser(await getDb(), family.id, session.userId, session.pinStamp) : null;
  if (!user) redirect("/sign-in");
  return { ...user, family };
}

export async function grantFamilyAccess(familyId: FamilyId): Promise<void> {
  const jar = await cookies();
  jar.set(FAMILY_COOKIE, await signFamilyToken(familyId), cookieOptions);
  // Entering a password starts fresh: never carry a person over from another family.
  jar.delete(SESSION_COOKIE);
}

export async function startSession(userId: string, pinStamp: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSessionToken(userId, pinStamp), cookieOptions);
}

export async function isAdmin(): Promise<boolean> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function grantAdmin(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, await signAdminToken(), { ...cookieOptions, maxAge: ADMIN_MAX_AGE_SECONDS });
}

export async function endAdmin(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Forget this device's family and person, back to the password screen. */
export async function leaveFamily(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(FAMILY_COOKIE);
}
