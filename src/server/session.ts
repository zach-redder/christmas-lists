import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
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

export async function hasFamilyAccess(): Promise<boolean> {
  return verifyFamilyToken((await cookies()).get(FAMILY_COOKIE)?.value);
}

/**
 * The signed-in person, verified against the database on every request.
 * Identity ALWAYS comes from the signed cookie, never from URLs or form fields.
 */
export async function requireUser(): Promise<PublicUser> {
  if (!(await hasFamilyAccess())) redirect("/welcome");
  const userId = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const user = userId ? await getUserById(await getDb(), userId) : null;
  if (!user) redirect("/sign-in");
  return user;
}

export async function grantFamilyAccess(): Promise<void> {
  (await cookies()).set(FAMILY_COOKIE, await signFamilyToken(), cookieOptions);
}

export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSessionToken(userId), cookieOptions);
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
