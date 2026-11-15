import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getFamily, type Family, type FamilyId } from "./families";
import {
  COOKIE_MAX_AGE_SECONDS,
  FAMILY_COOKIE,
  SESSION_COOKIE,
  signFamilyToken,
  signSessionToken,
  verifyFamilyToken,
  verifySessionToken,
} from "./tokens";
import { getUserById, type PublicUser } from "./users";

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
  const userId = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  // Only people in the device's family count: a session from another family means "sign in again".
  const user = userId ? await getUserById(await getDb(), family.id, userId) : null;
  if (!user) redirect("/sign-in");
  return { ...user, family };
}

export async function grantFamilyAccess(familyId: FamilyId): Promise<void> {
  const jar = await cookies();
  jar.set(FAMILY_COOKIE, await signFamilyToken(familyId), cookieOptions);
  // Entering a password starts fresh: never carry a person over from another family.
  jar.delete(SESSION_COOKIE);
}

export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSessionToken(userId), cookieOptions);
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
